# Installation

## Try the app

The application is available at [classodyssey.com](https://classodyssey.com).
It is a beta: before real classroom use, review its limits, the legal texts,
your school's rules and data protection requirements.

## Develop on your computer

Requirements: Node.js 22.9 or later, npm, Git and Git LFS. Python 3 is also
needed for the full syntax check. Blender is not required for ordinary use: the
shipped models are fetched through LFS.

```sh
git clone https://github.com/motmot3000/Class-Odyssey.git
cd Class-Odyssey
git lfs install --local
git lfs pull
npm ci
cp .env.example .env
```

Set a personal `FOUNDER_USERNAME` and `FOUNDER_PASSWORD` for local development,
and never commit them. Then:

```sh
npm run dev:app
```

Open the printed URL, normally `http://127.0.0.1:5180`. Create a class and
fictional heroes: a new account starts empty. Editing `.env` does not reset an
account that already exists.

`npm run dev` starts the app on 5180 **and** the 3D workshop on 5201. To discover
the game, `dev:app` is the simplest entry point.

The [detailed guide](https://github.com/motmot3000/Class-Odyssey/blob/main/docs/getting-started.md)
covers ports, optional Google sign-in, storage and LFS errors. Missing models or
"glTF" errors are often caused by unreplaced LFS pointers: do not skip the tests
to work around that problem.

Next: [Game rules](Game-rules) · [Development and testing](Development-and-testing)
