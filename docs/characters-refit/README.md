# Character refit and reference geometry

This pipeline supplies the two base heroes used by the equipment catalogue,
live portraits and dressing room. The approved result combines the `Douce`
expression, shared reference-eye maps and the second (`athletic`) body-shape
pass. Earlier expression and surface variants are comparison inputs, not
alternative live renderers.

## Immutable reference faces

`assets/characters-approved/faces-v1/` contains standalone GLBs, previews and
SHA-256 hashes. `tools/freeze_approved_faces.py` validates an existing snapshot
and refuses to overwrite it. Its `index.html` displays the approved references
independently of later body changes.

The body pipeline applies `refit_body_shapes.py` fields `v1` then `v2` to skin,
trousers and fitted outfits. Everything above **1.455 m** is protected, including
head/hair normals. Athletic silhouettes reduce rear projection, define the male
torso/shoulders/arms and gently adjust the female hips/thighs/upper torso. Faces
must not drift as a side effect of clothing or body work.

- `tests/approved-faces.test.mjs` guards frozen hashes, face/hair positions and
  UVs, with re-export normal tolerance below 0.06°.
- `tests/items-3d.test.mjs` compares shipped body geometry against
  `assets/character-detail-study/*-athletic.glb`.
- `assets/character-detail-study/athletic-body-shapes.json` records body changes.

Do not delete the study GLBs as unused screenshots: they are regression fixtures.
Do not regenerate frozen references merely to make a changed model pass tests.

## Authoring modules

| File | Role |
| --- | --- |
| `tools/prepare_refit_textures.py` | Deterministic skin, face, iris, normal and roughness maps |
| `tools/blender/prepare_refit_hair.py` | Extract, simplify and align supplied base hair |
| `tools/port-medium-cut.py` | Import the supplied medium-cut archive |
| `tools/medium_cut_locks.py` | Rebuild its front as fitted ribbon locks |
| `tools/blender/build_expression_study.py` | Compare eyebrow/mouth expressions and rear hair coverage |
| `tools/blender/build_warm_eyes_study.py` | Compare reference iris and eyelid adjustments |
| `tools/blender/build_body_shape_study.py` | Compare protected body-shape fields |
| `tools/blender/render_character_views.py` | Render comparisons without modifying the catalogue |
| `tools/finalize_character_views.py` | Convert comparison renders to WebP with provenance |
| `character-detail-study.html` | Review the retained body variants |

The catalogue builder applies `soften_face`, `refine_eyelids`, approved eye maps
and body fields directly. It removes the starter collar/scarf/pendant and keeps
the anatomical anchor contract. Hair source heads are discarded; only the
supplied hair is retained. See the [equipment guide](../items-3d/README.md) for
current catalogue commands, ear/hair variants, previews and held-item fitting.

## Reproduction

Use Blender 5.2 for current builds and Pillow for image conversion. Source
archives referenced below must be supplied separately; checked-in derived assets
are sufficient to run the app and tests without those archives.

```sh
python3 tools/prepare_refit_textures.py
blender -b --factory-startup --python-exit-code 1 \
  --python tools/blender/prepare_refit_hair.py -- \
  /path/to/blender-hair-model.zip /path/to/hunter-hairr-obj.zip
```

Rebuild both catalogues and previews using the equipment guide. For isolated
studies, load the authoring scene explicitly:

```sh
# Expression comparisons.
python3 tools/prepare_expression_textures.py
blender -b assets/items-3d/catalogue.blend --python-exit-code 1 \
  --python tools/blender/build_expression_study.py

# Retained second body-shape pass; preserves frozen heads.
BODY_SHAPE_REVISION=v2 blender -b assets/items-3d/catalogue.blend \
  --python-exit-code 1 --python tools/blender/build_body_shape_study.py

python3 tools/finalize_character_views.py
node --test tests/approved-faces.test.mjs tests/items-3d.test.mjs
node tools/serve-character-study.mjs
```

The review server defaults to port 5202. A study render is not a catalogue
release: validate it before integrating geometry and updating cache revisions.

For a before/after comparison, use separate scene files:

```sh
blender -b /path/to/catalogue-before.blend --python-exit-code 1 \
  --python tools/blender/render_character_views.py -- before assets/character-detail-study
blender -b assets/items-3d/catalogue.blend --python-exit-code 1 \
  --python tools/blender/render_character_views.py -- after assets/character-detail-study
python3 tools/finalize_character_views.py
```

## Texture and source provenance

The approved eye treatment uses the supplied Link reference maps on both
characters, with softened whites, finer detail and a small highlight. Eyelid
fitting is independent of the eyeball to preserve circular irises. The earlier
female-specific blue-gray correction is not the approved treatment.

Source body records retain **Nintendo / The Models Resource — Trikeboy**.
Supplied hair archives carry no embedded author or license; their SHA-256 hashes
are recorded in `assets/characters-refit/hair/*.json`. Reworked face textures
retain the Nintendo origin of the surface-v3 inputs. Preserve these records;
modification and repository visibility do not establish redistribution rights.
