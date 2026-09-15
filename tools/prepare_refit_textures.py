"""Author the refit skin, face and iris maps for the character refonte.

Input: the delivered surface-v3 maps (assets/characters-refined/textures).
Output: assets/characters-refit/textures — the same UV islands with finer,
less airbrushed material detail. Reproducible, seeded, and provenance-stamped.

    python3 tools/prepare_refit_textures.py
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets/characters-refined/textures'
OUT = ROOT / 'assets/characters-refit/textures'
OUT.mkdir(parents=True, exist_ok=True)
SEED = 20260915
rng = np.random.default_rng(SEED)
GENERATOR = 'tools/prepare_refit_textures.py'


def load(path, size, mode='RGBA'):
    return np.asarray(Image.open(path).convert(mode).resize((size, size), Image.Resampling.LANCZOS), dtype=np.float32) / 255


def save(name, rgb, origin, size=None):
    array = np.clip(rgb, 0, 1)
    image = Image.fromarray(np.uint8(array * 255))
    image.save(OUT / name)
    (OUT / f'{name}.json').write_text(json.dumps({
        'origin': origin, 'generator': GENERATOR, 'seed': SEED,
        'revision': 'characters-refit-v1', 'integrated': True,
    }, indent=2) + '\n')


def low_frequency(size, cells, blur):
    """Soft, non-tiling mottle field: one independent random map per channel."""
    layers = []
    for _ in range(3):
        noise = rng.uniform(0, 255, (cells, cells)).astype(np.float32)
        layer = Image.fromarray(np.uint8(noise)).resize((size, size), Image.Resampling.BICUBIC)
        layers.append(np.asarray(layer.filter(ImageFilter.GaussianBlur(blur)), dtype=np.float32) / 255 - .5)
    return np.stack(layers, axis=-1)


def enhance_skin(rgb, size, warmth):
    """Turn a flat, airbrushed game skin into a plausible photographed surface."""
    rgb = rgb.copy()
    rgb[:, :, :3] += low_frequency(size, 44, 20) * np.array([.016, .012, .010])
    rgb[:, :, :3] += low_frequency(size, 96, 5) * .012
    # Pores: band-limited, denser on the face than on the neck and body.
    pores = rng.normal(0, 1, (size, size)).astype(np.float32)
    pores = np.asarray(
        Image.fromarray(np.uint8(np.clip(pores * 40 + 128, 0, 255))).filter(ImageFilter.GaussianBlur(.5)),
        dtype=np.float32) / 255 - .5
    rgb[:, :, :3] += (pores * .035)[:, :, None]
    # A touch of warm subsurface colour across the whole skin field.
    rgb[:, :, 0] += warmth * .012
    rgb[:, :, 2] -= warmth * .008
    return rgb


def enhance_face(rgb, size, warmth, feminine):
    rgb = enhance_skin(rgb, size, warmth)
    # Cheeks and lips carry more life than the rest of the face.
    rgb[:, :, 0] += low_frequency(size, 14, 18)[:, :, 0] * warmth * .018
    return rgb


def soften_normal(path, size, strength, grain):
    normal = np.asarray(Image.open(path).convert('RGB').resize((size, size), Image.Resampling.LANCZOS), dtype=np.float32) / 127.5 - 1
    normal[:, :, :2] *= strength
    normal[:, :, :2] += rng.normal(0, grain, (size, size, 2))
    normal /= np.maximum(np.linalg.norm(normal, axis=2, keepdims=True), .0001)
    return normal * .5 + .5


def render_iris(source, size, palette, feminine):
    """Rebuild a real iris: radiating fibres, limbal ring, pupil, catchlight."""
    n = size
    y, x = np.mgrid[0:n, 0:n] / n
    base = np.asarray(Image.open(source).convert('RGB'), dtype=np.float32) / 255
    saturation = base.max(axis=2) - base.min(axis=2)
    ys, xs = np.where(saturation > .12)
    if not len(xs):
        raise ValueError(f'No iris found in {source}')
    cx, cy = xs.mean() / base.shape[1], ys.mean() / base.shape[0]
    radius = np.sqrt((x - cx) ** 2 + (y - cy) ** 2)
    angle = np.arctan2(y - cy, x - cx)
    iris_radius = .210 if feminine else .205
    r = radius / iris_radius
    rings = (.55 * np.sin(angle * 79 + np.sin(angle * 23) * 3 + r * 15)
             + .28 * np.sin(angle * 151 - r * 22)
             + .17 * np.sin(angle * 263 + r * 33))
    iris = np.zeros((n, n, 3), np.float32) + np.array(palette)
    iris *= (1 + .26 * rings)[:, :, None]
    iris += np.exp(-((r - .52) / .20) ** 2)[:, :, None] * np.array([.10, .05, -.015])
    iris *= (1 - .72 * np.exp(-((r - .94) / .07) ** 2))[:, :, None]
    pupil = np.clip((r - .30) / .04, 0, 1)
    iris = iris * pupil[:, :, None] + np.array([.015, .019, .020]) * (1 - pupil[:, :, None])
    sclera = np.array([.90, .88, .855])
    eye = sclera * np.ones((n, n, 3), np.float32)
    eye *= (1 - .10 * np.clip(1 - r, 0, 1))[:, :, None]
    blend = np.clip((1 - r) / .02, 0, 1)
    eye = eye * (1 - blend[:, :, None]) + iris * blend[:, :, None]
    highlight = np.exp(-(((x - (cx - .05)) / .028) ** 2 + ((y - (cy - .05)) / .028) ** 2))
    eye += highlight[:, :, None] * .55
    return eye, cx, cy


FACE = {
    'girl': {'source': 'head-girl-medium.png', 'warmth': 1.0, 'palette': (.27, .40, .28), 'feminine': True},
    'boy': {'source': 'head-boy-medium.png', 'warmth': .8, 'palette': (.28, .34, .30), 'feminine': False},
}
for gender, config in FACE.items():
    source = SOURCE / config['source']
    pixels = load(source, 2048)
    alpha = pixels[:, :, 3:4]
    rgb = enhance_face(pixels[:, :, :3], 2048, config['warmth'], config['feminine'])
    save(f'head-{gender}-medium.png', np.concatenate([rgb, alpha], axis=2),
         f'Derived from {source.relative_to(ROOT)}: fine pore grain, non-tiling mottle, warm subsurface tint and livelier cheeks.')
    for side in ['left', 'right']:
        source_eye = SOURCE / f'eye-{gender}-{side}.png'
        eye, _, _ = render_iris(source_eye, 512, config['palette'], config['feminine'])
        save(f'eye-{gender}-{side}.png', eye,
             f'Procedural iris rebuilt over {source_eye.relative_to(ROOT)}: radiating fibres, limbal ring, reduced pupil, catchlight.')

skin = load(SOURCE / 'skin-medium.png', 1024)
save('skin-medium.png', enhance_skin(skin, 1024, .6),
     f'Derived from {(SOURCE / "skin-medium.png").relative_to(ROOT)}: pore grain, mottle and warm subsurface tint on the body atlas.')
save('normal-head.png', soften_normal(SOURCE / 'normal-head.png', 2048, .58, .020),
     'Derived from normal-head.png: softened game relief plus fine pore-scale normals.')
save('normal-skin.png', soften_normal(SOURCE / 'normal-skin.png', 1024, .62, .022),
     'Derived from normal-skin.png: softened relief plus fine cloth-free skin grain.')
rough_head = load(SOURCE / 'rough-head.png', 2048, 'L')
rough_head = np.clip(rough_head * .52 + .34 + rng.normal(0, .010, (2048, 2048)), .50, .74)
save('rough-head.png', np.repeat(rough_head[:, :, None], 3, axis=2),
     'Derived from rough-head.png: matte skin response, no plastic sheen.')
rough_skin = load(SOURCE / 'rough-skin.png', 1024, 'L')
rough_skin = np.clip(rough_skin * .45 + .42 + rng.normal(0, .010, (1024, 1024)), .54, .78)
save('rough-skin.png', np.repeat(rough_skin[:, :, None], 3, axis=2),
     'Derived from rough-skin.png: matte body skin response.')
# Woven trousers maps remain current for this revision; carried over with
# provenance so the catalogue reads every surface from one directory.
for name in ['trousers.png', 'normal-trousers.png', 'rough-trousers.png']:
    source = SOURCE / name
    (OUT / name).write_bytes(source.read_bytes())
    (OUT / f'{name}.json').write_text(json.dumps({
        'origin': f'Carried over unchanged from {source.relative_to(ROOT)} for the refit revision.',
        'generator': GENERATOR, 'revision': 'characters-refit-v1', 'integrated': True,
    }, indent=2) + '\n')
print('REFIT_TEXTURES_READY', OUT)
