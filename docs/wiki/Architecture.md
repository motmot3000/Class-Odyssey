# Architecture

Class Odyssey uses browser-side JavaScript ESM and a Node.js HTTP server.
Three.js renders the characters. Data is stored as JSON files isolated per
account; the browser keeps a local cache.

| Layer | Responsibility |
| --- | --- |
| `src/domain.mjs` | Game catalogue and transitions, without DOM or network |
| `src/state-schema.mjs` | Shape validation shared by browser and API |
| `src/app.mjs` | Routing, actions, UI state and synchronisation |
| `src/views/` | Escaped HTML; the main active screen is `odyssey.mjs` |
| `src/session.mjs`, `src/api.mjs` | Account, session and bounded API calls |
| `server/server.mjs` | HTTP routes and controls |
| `server/api.mjs` | Accounts, password derivation, storage and backups |
| `server/static.mjs` | Allowed public files, never data or secrets |

## Invariants to preserve in a pull request

1. An action produces a domain transition before saving.
2. The cache stays bound to the right account and keeps unsynchronised changes.
3. A PUT carries the current revision; a conflict receives 409, with no implicit
   overwrite.
4. An asynchronous result must not modify the account that replaced the one
   captured when the request started.
5. The teacher unlock is not a separate server identity per student.
6. Storage assumes a single Node writer per data folder.

## 3D pipeline

Look models, slots and selections are separate from Three.js rendering. One
visible canvas is shared between views; portraits use an off-screen renderer and
a bounded cache. Both the host lifetime and the resource lifetime must be
checked to avoid late mounts. Generated bundles must come from the sources, not
be edited by hand.

See the [full code map](https://github.com/motmot3000/Class-Odyssey/blob/main/docs/code-map.md)
and the [3D pipeline](https://github.com/motmot3000/Class-Odyssey/blob/main/docs/items-3d/README.md).
Prototypes and old renderers are not automatically the game runtime.

Next: [Backend and data](Backend-and-data) · [Development and testing](Development-and-testing)
