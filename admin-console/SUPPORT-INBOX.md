# Support inbox contract (from the settings branch)

The `motmot3000/settings` branch adds a **Help / Aide** dialog in the account
settings. When a signed-in teacher sends a message it is stored once, in the
shared data directory, so this admin console can read it and notify the owner.

Nothing here is implemented in this worktree yet — this file is the agreed
interface so both branches land compatible code.

## Storage

`dataDir/support-messages.json`

```json
{
  "messages": [
    {
      "id": "8-byte hex",
      "at": "2026-09-24T18:00:00.000Z",
      "status": "open",
      "note": "",
      "accountId": "24-hex",
      "username": "teacher@example.com",
      "displayName": "teacher",
      "email": "teacher@example.com",
      "category": "bug",
      "subject": "short optional subject",
      "message": "the free-form message"
    }
  ]
}
```

- `status`: `open` | `read` | `done`. A new message is `open`.
- `note`: optional internal note written from the console.

## Reusable module (on the settings branch)

`server/support.mjs` exports `createSupportStore({ dataDir })` returning:

- `list()` → the messages (newest first)
- `unreadCount()` → number of `open` messages
- `update(id, { status, note })` → updated message or `null`

`server.mjs` on the settings branch already calls `support.add(...)` from
`POST /api/support/messages` (session-authenticated, rate-limited).

## Endpoints this console should add (game server, `X-Console-Key` guarded)

- `GET  /api/console/support` → `{ messages: [...], unread: <n> }`
- `PATCH /api/console/support/:id` body `{ status?, note? }` → updated message

And expose the unread count for the notification badge, either as a field in
`GET /api/console/overview` (e.g. `supportUnread`) or by calling the list route.

## Local proxy (`admin-console/server.mjs`)

Widen `API_PATH` so `/api/support` and `/api/support/<id>` are proxied, which
maps to the game server `/api/console/support...`.
