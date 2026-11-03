# Branches and archives

**`main` is the only active integration branch.** Contributions use temporary
branches or forks and open a pull request against `main`. There is no permanent
`dev` branch to target.

The old version branches are no longer active. Their tip and history are kept by
annotated tags before removal from the branch list:

| Old branch | Archive tag |
| --- | --- |
| `version/alpha` | `archive/alpha-2026-10-26` |
| `version/beta` | `archive/beta-2026-10-26` |

These tags are **archives**, not supported versions, stable releases or proof of
a deployment. The alpha archive notably contains commits that were not merged
into `main`; removing it from the branch list must not mean losing that work.

Inspect an archive without changing `main`:

```sh
git fetch origin --tags
git switch --detach archive/alpha-2026-10-26
```

To resume that work, create a new branch from the tag rather than modifying the
tag itself. Details and fingerprints are in
[branch history](https://github.com/motmot3000/Class-Odyssey/blob/main/docs/branch-archives.md).

A merged pull request is not automatically deployed to the website.
