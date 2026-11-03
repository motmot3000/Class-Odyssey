# Backend, data and self-hosting

The Node server serves the frontend and the API from the same origin. Each
account has its own state and JSON backups under `DATA_DIR`. The browser cache
keeps unsynchronised changes, but it is not a substitute for an independent
backup and does not guarantee an offline start from a fresh browser.

## Key points

- One writer process per data folder; no multi-process replication on a shared
  volume without a different storage design.
- Sessions are bound to the account. Passwords are derived with `scrypt`; tokens
  are stored as hashes on the server.
- Revisions and 409 responses prevent silent overwrites between copies.
- State is limited to 4 MiB; rotating backups have count and size bounds.
- A new account has no class and no student. Test fixtures are not starter data
  for users.
- Google sign-in, recovery email and local GeoIP are optional.
- Class data, accounts, IP addresses and support messages must never be
  committed.

## Two different consoles

The **teacher console** lives in the browser of the signed-in account and
unlocks temporarily. The **operator console** is a separate server, protected by
its network access and a server key. Never expose it to the internet, and never
confuse its power with a student's.

## Running your own instance

Plan for a persistent volume with appropriate permissions, a trusted TLS reverse
proxy, independent and tested backups, migrations and rollback. Configure the
optional services and adapt the legal contacts and texts to your instance.
Self-hosting does not authorise reuse of the maintainer's secrets or access.

A merge into `main` is not a deployment. Check separately the commit, the build,
the service actually running and the user journeys.

References: [Backend and API](https://github.com/motmot3000/Class-Odyssey/blob/main/BACKEND.md),
[operator console](https://github.com/motmot3000/Class-Odyssey/blob/main/admin-console/README.md),
[security](https://github.com/motmot3000/Class-Odyssey/blob/main/SECURITY.md).

Next: [Project and maintenance](Project-and-maintenance) · [Licenses and assets](Licenses-and-assets)
