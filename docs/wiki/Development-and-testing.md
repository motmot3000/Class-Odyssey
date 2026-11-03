# Development and testing

## Automated checks

After fetching Git LFS and installing dependencies:

```sh
npm run check
```

This command checks the syntax of JavaScript and Python sources, then runs the
`node --test` suite. Python 3 is required; Blender is not required for the
ordinary suite. `npm test` runs only the JavaScript and HTTP tests.

The tests cover the domain, sessions, account isolation, backups, conflicts,
public files, translations, anchors and model consistency. A passing suite is
not a security or availability certification.

## Manual checks

For an interface pull request, test with fictional data: sign-in and unlock,
class and selection, XP/level/HP, Shop → purchase → Wardrobe → portrait,
export/import, save conflict, French/English, light/dark, keyboard and
mobile/whiteboard. State precisely which journeys and devices were actually
verified.

## Sources and builds

Edit the source modules, then build the affected bundles. Do not edit minified
JavaScript in the assets by hand. `npm run build:items-3d` and
`npm run build:odyssey` build JavaScript; they do not remodel the characters.
The Blender pipeline is separate, and some historical work needs external
archives.

The [detailed guide](https://github.com/motmot3000/Class-Odyssey/blob/main/docs/development.md)
gives the commands, the test map and the manual checks.

## Documentation and wiki

Technical pages are versioned with the code. The sources of this wiki live in
`docs/wiki/` and can be corrected in a pull request. The wiki is a separate Git
repository: publishing it is an explicit maintenance action, not an automatic
sync after every merge.

Next: [Backend and data](Backend-and-data) · [Contributing](Contributing)
