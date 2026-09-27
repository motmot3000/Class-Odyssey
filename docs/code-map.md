# Class Odyssey code map

## Start here

- `main` is the published version. Integration and manual testing happen on `dev`.
- `npm run dev` starts the app and API together. It may choose another port if the configured one is occupied; use the URL printed by the server.
- `npm run check` parses authored JavaScript and Python, then runs the test suite. It requires Node.js and Python, but not Blender.
- `npm test` runs only the automated JavaScript/HTTP tests.

## Runtime layers

| Area | Files | Responsibility |
| --- | --- | --- |
| Application coordinator | `src/app.mjs` | Routes, action/form registries, transient UI state, undo and optimistic synchronization |
| Game rules and catalogue | `src/domain.mjs` | Pure state transitions, XP, HP, inventory, purchases and import migration |
| Persisted shape | `src/state-schema.mjs` | Shared browser/API validation; no DOM or filesystem dependency |
| Authentication client | `src/session.mjs`, `src/api.mjs` | Session tokens, bounded API calls, offline verifier and account-bound teacher unlock |
| Screens | `src/views/` | Escaped HTML; the active game screens live in `odyssey.mjs` |
| Shared UI and languages | `src/ui.mjs`, `src/i18n*.mjs` | Icons, titles, stats and keyed FR/EN copy |
| HTTP routes | `server/server.mjs` | Authentication, request validation, per-client rate limits (trust-proxy aware), account caps and revision conflict responses |
| Disk persistence | `server/api.mjs` | Password hashing, token index, atomic writes and backup recovery |
| Public files | `server/static.mjs` | Allowlisted paths, symlink checks, correct 404 responses and streamed assets |

`src/views/board.mjs` and `src/views/student.mjs` are retained legacy renderers. They are **not** the active Odyssey picker/board. `src/avatar.mjs` also retains the vector renderer and shared stat icons. Do not mistake either for the source of current 3D portraits.

## A state change, end to end

1. A delegated click or form submission reaches an `ACTIONS`/`FORMS` handler in `app.mjs`.
2. A domain function returns a new state; invalid/no-op operations return the original state.
3. `commit()` records undo history and writes the account-scoped local cache before scheduling a server save.
4. The API accepts a `PUT /api/state` only when its revision matches the stored revision. A successful write increments the revision; a stale write receives **409**, never an automatic overwrite.
5. If offline or conflicted, the dirty local copy stays available. Explicit conflict recovery archives that copy before loading the server version.

The main route is a single `#class` space. Pupils can view characters and use
the Dressing and Shop. Navigation follows one hierarchy — **Class → Hero sheet
→ Dressing / Shop** — where Dressing and Shop return to the hero through the
same top-left control, and the hero sheet returns to the class. The teacher
console is a native dialog, reached through the fixed right-edge tab and
password verification. Its non-modal panel is docked on the right, so the
class remains interactive. Folding it preserves the five-minute grant;
adding a pupil temporarily opens a child form and returns to the console.
Individual selection is singular; **Whole class** is a reversible selection
toggle, and rewards always target the visible selection.

The browser teacher gate is a classroom interaction safeguard, not a separate server identity for pupils. The API authenticates the account token; admin routes additionally require the admin role. Unlock state is bound to its account and expires five minutes after password verification. Folding/reopening does not extend this deadline. Explicit locking or sign-out revokes it immediately.

Every asynchronous result must check its captured account/token before touching state. In particular, imports, saves and password checks must not act on a newly signed-in account. The server rechecks sessions after receiving request bodies because a token may have been revoked while a body was arriving.

## 3D and previews

- `src/items-3d-model.mjs`: serializable looks, catalogue revision, slot/persona visibility and share-link validation.
- `src/items-3d-viewer.mjs`: Three.js renderer, framing, item isolation, lighting, export and GPU disposal.
- `src/odyssey-viewer.mjs`: small adapter between the game screens and the catalogue viewer.
- `src/odyssey-runtime.mjs`: owns the one visible canvas and moves it between current view hosts.
- `src/shared-resource.mjs`: shared in-flight loading with generation-based reset. A late result after a retry is disposed, not mounted.
- `src/portrait-runtime.mjs`: one offscreen renderer, serialized jobs and a 64-entry LRU image cache. Equal looks share a job.
- `src/portrait-image.mjs`: transparent-margin detection and full-silhouette image framing.
- `src/equipment-previews.mjs`: HTML for current-model portraits, item-only thumbnails and non-3D swatches.

The shop previews **only the selected product**. The workshop renders the hero's equipped look. A preview does not buy/equip an item. Titles come from `pupil.title`, never from the outfit or hair colour.

Earned titles form a five-step prestige ladder (`titleTierOf`): the tier decides the
title colour, ornament, glow and the `.title-halo` / `.title-emblem` backdrop behind
the character. Tier 1 is neutral; the top tier adds gold rays and a title-specific
emblem. `titleBackdropAttributes(pupil)` is applied to every character dais (class
cards and the hero sheet), and the character always renders above the backdrop.

Two different lifetime checks matter: **host identity** prevents mounting into an old screen; **resource generation** prevents an obsolete load from replacing a retried viewer. Keep both.

## Sources versus generated files

Do not hand-edit minified files in `assets/odyssey/` or `assets/items-3d/web/`:

```sh
npm run build:items-3d
npm run build:odyssey
```

The equipment build removes obsolete, known generated chunk filenames only
after a successful build. The entry file and its lazy imports come from the
same esbuild output graph; unrelated files are not pruned.

For geometry, `tools/build-items-3d.py` imports immutable source characters, fits clothing/armour to anatomical contours and emits `catalogue.blend`, `catalogue.glb` and its manifest. `tools/render-equipment-previews.py` renders product-only images and portraits; `tools/finalize-equipment-previews.py` produces WebP files. See [the equipment pipeline](items-3d/README.md) for commands and Blender/Pillow requirements.

The base characters' faces, skin and starter outfit come from the refit revision: `tools/prepare_refit_textures.py` authors `assets/characters-refit/textures`, the catalogue build re-sculpts the frontal face bowl and applies the approved `Douce` expression and reference-eye maps, and drops the starter collar. `tools/freeze_approved_faces.py` keeps the frozen snapshots in `assets/characters-approved/faces-v1`. Haircuts are shared by both characters for now: `HAIR_ITEMS=short,long,medium-cut,curly` makes the build ship the three delivered cuts (`SUPPLIED_HAIR`, fitted to each head) plus the sculpted Afro, so `HAIRS` is `short`/`long`/`medium-cut`/`bald`/`curly` and Braids/Royal Hair stay out. The cosmetics catalogue is scoped down: Archmage and King outfits and the whole Items category are withdrawn (`no-weapon` remains internal only), there is one outfit per level up to 10 (Bard 1 … Horse Keeper 10); every outfit above Ranger is a full outfit that hide the delivered trousers (`coversLegs`, `core_part`) while the boots stay, and Guerrier/Chevalier ship with leg armour, tattoos and Golden Skin are removed, and Explorer/Champion/King/Legend keep their names with their own accent and badge. See [the refit revision](characters-refit/README.md).

Skin tone is applied at runtime: one medium albedo is baked and `src/items-3d-viewer.mjs` multiplies the `base_skin_map` / `skin_plain` materials by the tone ratio from `SKIN_TONE_COLORS` (`src/items-3d-model.mjs`). The tone field rides in the look (`tone`), so portraits, the dressing and the shop all agree. Faces are paused (empty category); tattoo skins and Golden Skin are removed.

The anatomical anchor contract is preserved. `tools/blender/refit_body_shapes.py` defines the validated athletic silhouettes; the catalogue build applies its `v1` then `v2` fields to the body, trousers and every fitted outfit, protecting everything above 1.455 m so the approved head and hair normals are copied verbatim. `tests/items-3d.test.mjs` asserts the shipped bodies match `assets/character-detail-study/*-athletic.glb` vertex for vertex, and `tests/approved-faces.test.mjs` guards the frozen face snapshot hashes. Generated preview manifests bind images to the catalogue SHA-256, so rebuild previews after geometry changes.

The character, surface, wardrobe and item workshops are development tools. Their experiments are not automatically the game's live renderer.

## Checks that protect behavior

- Domain tests: progression, purchase ownership, import shape, numeric bounds and no-op behavior.
- HTTP tests: account isolation, revisions, backups, request limits, token revocation and public-file boundaries.
- Session tests: wrong-password versus expired-session handling, cross-account protection and offline behavior.
- Shared-resource tests: late loads/rejections after reset and retry/disposal behavior.
- 3D tests: source geometry, attachment matrices, model slot selection, waist seams and thumbnail integrity.
- Interface/i18n tests: title identity, escaping, FR/EN rendering and unchanged Rules text.

For browser smoke tests use an isolated `DATA_DIR`. Check login/unlock, shop → purchase → workshop → updated portrait, Rules, admin, both themes and mobile. Do not reset real classroom data as part of a test.

The file-backed API assumes one Node.js writer per data directory. Synchronous state/index writes serialize mutations within that process; multiple server processes would require a database or explicit cross-process locking.
