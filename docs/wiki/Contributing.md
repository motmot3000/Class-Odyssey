# Contributing

Developers, teachers, testers, translators and artists are welcome. A good
contribution can be a corrected guide, a bug scenario, a regression test or a
well-documented original asset. French and English are both accepted.

## How a contribution moves

1. Read the [installation](Installation) and [architecture](Architecture) guides.
2. Look for an existing issue or pull request. Discuss large changes to
   pedagogy, data, architecture, dependencies or the catalogue first.
3. Fork the repository and create a working branch from `main`.
4. Make a focused change with its tests and documentation.
5. Run `npm run check` and manually verify the affected journeys.
6. Open a pull request **against `main`**, explaining the problem, the evidence
   and the risks.

There is no permanent `dev` branch. Older versions are kept as
[archive tags](Branches-and-archives). The maintainer merges as time allows; a
pull request creates no deadline and no automatic deployment.

## Responsibilities

- Code and commits in English; review discussions may be in French or English.
- No real student data, production exports, secrets or private logs.
- Understand the proposed code, including AI-generated code; disclose
  substantial help and report real test results.
- Respect licenses and keep third-party notices.
- Do not bypass a test to make the suite pass.
- Stay respectful and consider everyone's time.

The detailed contract is in
[CONTRIBUTING.md](https://github.com/motmot3000/Class-Odyssey/blob/main/CONTRIBUTING.md),
with Git commands and the checklist. Also read the
[code of conduct](https://github.com/motmot3000/Class-Odyssey/blob/main/CODE_OF_CONDUCT.md).

Report a vulnerability [privately](https://github.com/motmot3000/Class-Odyssey/blob/main/SECURITY.md),
not in a public issue containing an exploit or sensitive data.

Next: [Development and testing](Development-and-testing) · [Branches and archives](Branches-and-archives)
