# Equipment and character pipeline

The live game loads **`assets/character-stylized/catalogue.glb`**, not the older
equipment catalogue. `assets/items-3d/catalogue.{blend,glb}` remains the authoring
and regression-test reference. Both catalogues are checked in through Git LFS.
Their current cache revisions live in `src/items-3d-model.mjs`; do not copy those
version strings into another source of truth.

## Ownership

| Source | Responsibility |
| --- | --- |
| `src/domain.mjs` | Item IDs, prices, unlock levels and saved inventory |
| `src/items-3d-model.mjs` | Serializable looks, palettes, model URLs and visibility |
| `src/items-3d-viewer.mjs` | Three.js renderer, lighting, framing and export |
| `tools/build-items-3d.py` | Source import, fitting and catalogue generation |
| `tools/blender/headwear.py` | Hats, crowns, helmet and glasses |
| `tools/blender/held_items.py` | Weapon/shield geometry and grip transforms |
| `tools/blender/arm_pose.py`, `fist_model.py` | Bent weapon arms and closed hands |
| `tools/blender/human_ears.py`, `human_ear_model.py` | Ear separation, skull closure and sculpted ears |
| `tools/blender/refit_body_shapes.py` | Protected body-shape deformation fields |
| `tools/render-equipment-previews.py` | Product-only shots and fallback portraits |
| `tools/finalize-equipment-previews.py` | Uniform thumbnail framing and WebP output |

The game catalogue includes outfits, hats, hair, colors, accessories, weapons,
shields, pets, skin tones and titles. Read exact contents from `domain.mjs`.
Do not infer game availability from geometry alone: some source variants exist
only for authoring or compatibility. Pets have a separate catalogue and pipeline
in `tools/build-pets.py` and `assets/pets/`.

## Running the workshop

```sh
npm ci
npm run build:items-3d
npm run dev:items-3d
```

Open **http://127.0.0.1:5201/items-3d.html**. This read-only server needs no
accounts or classroom data. `PORT` changes its listener port. The workshop can
inspect an explicit base, for example
`items-3d.html?model=/assets/character-stylized/catalogue.glb`.

Categories can be tried independently of purchase requirements. Validated look
IDs are stored in the share URL. Export can include the equipped character or
equipment only; unrelated variants are filtered out. The SVG comparison is a
workshop reference, not the live game renderer. Models are static, without an
animation rig. Rotation is opt-in; fallback posters remain usable without WebGL.

## Rebuilding geometry

Use **Blender 5.2** for the current authoring pipeline. Some older workshop
notes describe Blender 4.5; they do not establish current build compatibility.
Python image-processing scripts additionally need Pillow; specialist import or
background-removal tools may have their own dependencies listed in docstrings.
Ordinary app work does not require rebuilding models.

Run from the repository root. Source snapshots under
`assets/items-3d/sources/{boy,girl}-medium.glb` are immutable inputs, with hashes
and pose metadata. Do not overwrite them to fix a derived outfit.

```sh
# Authoring/test catalogue.
HAIR_ITEMS=short,long,medium-cut,curly,spiky,bun \
  blender -b --factory-startup --python-exit-code 1 --python tools/build-items-3d.py

# The stylized catalogue actually loaded by the live game.
STYLIZED=1 HAIR_ITEMS=short,long,medium-cut,curly,spiky,bun \
  blender -b --factory-startup --python-exit-code 1 --python tools/build-items-3d.py
```

Keep the explicit hair list: the builder supports additional experimental
families that should not silently return to the shipped catalogue. Bald needs
no hair mesh. `SKIP_CATALOGUE_RENDER=1` skips the catalogue poster render;
`STYLIZED_OUT` selects an alternate stylized output directory for isolated review.
Inspect changes there before replacing delivered assets.

On Flatpak installations use `flatpak run --cwd="$PWD" org.blender.Blender`
instead of `blender` and an absolute `--python "$PWD/tools/..."` path.

### Previews and bundles

```sh
blender -b assets/items-3d/catalogue.blend --python-exit-code 1 \
  --python tools/render-equipment-previews.py
python3 tools/finalize-equipment-previews.py
npm run build:items-3d
npm run build:odyssey
npm run check
```

The preview renderer and finalizer share `EQUIPMENT_PREVIEWS_DIR` (default: a
`class-odyssey-equipment-previews` directory under the system temp directory).
Set the same override for both commands. The renderer also reads the stylized
catalogue for live fallback portraits. `--portraits-only` limits both scripts
to portraits; the renderer receives script arguments after Blender's `--`.

`previews/manifest.json` binds product images to the catalogue SHA-256. Geometry
changes require new previews, not merely a cache-version bump. The finalizer
fits item silhouettes into 84% of a square frame; `--normalize-only` reframes
existing WebPs without a Blender render. It overwrites those derived images.

Generated files in `assets/items-3d/web/` and `assets/odyssey/` must not be edited
by hand. Their sources are under `src/`; rebuild from merged source after a
conflict. Invalidate catalogue/portrait revisions when visible geometry changes.

## Geometry contracts

### Coordinates and source integrity

- Meters; Blender Z-up, facing −Y; glTF Y-up, facing +Z; feet at the origin.
- Source pose: arms lowered 82° from T, elbows bent 8°, fingers 10°, palms toward
  thighs. Equipped weapon arms may use an additional derived bent pose.
- Import sanitization keeps the active default scene, remaps nodes and discards
  unused skins/animations; it must not alter original geometry/texture BIN bytes.
- Source manifests record hashes, pose and anatomical anchors. Current anchors
  are `hat_seat`, `grip_right`, `grip_left`, `wrist_left` and `back`.
- Per-persona `headFits` maps the authored template onto each source head. Do
  not substitute the obsolete fixed `hat-seat` coordinates from early studies.
- `attachment_origin`, `attachment_quaternion` and `template_to_character`
  preserve the measured source-frame contract in glTF coordinates.

### Part selection and outfits

`shop_slot`, `shop_id`, `fit_persona`, `hat_fit` and other part properties drive
`visiblePart()` in `items-3d-model.mjs`. Item IDs must match the domain catalogue.
Validate every addition on **both** personas, not just the default character.

Outfits fit measured anatomical surfaces rather than arbitrary ellipses.
`split_footwear` separates persistent boots (`core_part: boots`) from trousers.
A `coversLegs` outfit hides trousers and supplies its own legs; boots remain.
The source has no skin under the trousers, so hiding them without replacement
leaves holes. Capes drape from the collar, widening past shoulders/arms; fittings
and ornaments use surface projection rather than detached fixed coordinates.

### Heads, hair and ears

Approved heads and hair normals are protected above 1.455 m during body-shape
passes. See the [refit guide](../characters-refit/README.md) and frozen face tests.

Hair families share authored geometry across both characters, transformed through
the measured hat seat. `open`, `covered` and `crowned` variants fit different
headwear; helmets hide hair. Normal/roughness maps and vertex shade differences
must survive runtime recoloring. The sculpted short cut uses measured skull
and ear contours (`tools/blender/sculpt_straight_short.py`), not generic clipping.

Default ears are sculpted human ears. Source elf ears are separate accessories;
pierced ears reuse the human form with asymmetric jewelry. Before separating
source ears, `cap_openings` closes the original skin boundary with a plain skin
texel. Otherwise a smaller ear exposes an open head or a textured patch.

Nearby hair strands can carry `ear_fit: human|elf`. `split_ear_variants` duplicates
only changed faces; the rest of the cut stays shared. `EAR_ACCESSORIES` selects
the correct ear/hair variant. The human short cut is built with `EAR_SHAPE=human`.
Long hair retains its tucked temple/back strands; do not cut them twice.

Hair import tools require explicit sources: set `BRAID_SOURCE` to the delivered
FBX for `tools/port-braid-cut.py`, and pass an archive after `--` to
`tools/port-medium-cut.py`. Original external archives are not included.
`tools/render-hair-sheet.py` uses the current checkout's stylized catalogue;
`HAIR_REVIEW_DIR` overrides its temporary render directory.

### Held items and materials

`hold_items()` runs after skin fitting. Open hands and closed SDF fists are
separate persona parts; fists grip a standard 2.7 cm handle. Weapon forearms
have straight and 78° bent variants, including sleeves and closed cut edges.
`visiblePart()` switches hands/arms from `look.weapon` / `look.shield`.

Weapons use `grip_frame('weapon') @ BLADE_TO_GRIP`; shields use the corresponding
shield frame. New handles align with +Z in blade space. Reuse the grip rather
than moving a weapon independently until it looks correct for one character.

Skin and eye colors are runtime material changes, not separate meshes. The
viewer multiplies medium skin albedo by the selected tone ratio; fists, ears,
neck and body must share that response. Preserve the material naming contract.

## Verification and provenance

- `tests/items-3d.test.mjs`: real GLBs, source integrity, geometry, attachment
  matrices, visibility combinations and export filters.
- `tests/approved-faces.test.mjs`: frozen face hashes and protected normals.
- `tests/equipment-previews.test.mjs`: preview hashes, framing and current looks.
- `tests/pets.test.mjs`: pet catalogue and live integration.
- Browser: both personas, headwear × hair × ear combinations, skin/eye colors,
  equipped weapon/shield, shop product-only preview, purchase → dressing → updated
  portrait, export, fallback/retry, desktop and mobile layouts.

Passing tests does not prove that every possible outfit is collision-free.
Inspect changed geometry from front, side and back before shipping it.

Keep source attribution, hashes and adaptations in the asset provenance files.
Existing records identify Nintendo / The Models Resource — Trikeboy for source
bodies and retain the source hero-shield attribution. Some supplied hair archives
have no embedded author/license; their hashes do not establish reuse rights.
Do not remove these warnings or infer a license from repository visibility.
