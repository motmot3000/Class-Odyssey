"""Export self-contained base/feminine SVGs from the editable ranger + base parts.

Run: python3 tools/svg/build-character-variants.py
Only generated SVG variants are written; the authored ranger stays the source.
"""
from copy import deepcopy
from pathlib import Path
import re
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets' / 'character-lab'
NS = 'http://www.w3.org/2000/svg'
ET.register_namespace('', NS)
tag = lambda name: f'{{{NS}}}{name}'
source = ET.parse(OUT / 'ranger-vector.svg').getroot()
parts = ET.parse(Path(__file__).with_name('base-parts.svg')).getroot()


def named(root, ident):
    return next(node for node in root.iter() if node.get('id') == ident)


def references(node):
    found = set()
    for item in node.iter():
        for key, value in item.attrib.items():
            if key.endswith('href') and value.startswith('#'):
                found.add(value[1:])
            found.update(re.findall(r'url\(#([^\)]+)\)', value))
    return found


def prune_defs(root):
    defs = root.find(tag('defs'))
    owners = {node.get('id'): child for child in defs for node in child.iter() if node.get('id')}
    needed = set().union(*(references(child) for child in root if child is not defs))
    kept = set()
    while needed:
        ident = needed.pop()
        owner = owners.get(ident)
        if owner is not None and owner not in kept:
            kept.add(owner)
            needed.update(references(owner))
    for child in list(defs):
        if child not in kept:
            defs.remove(child)


def export(outfit, feminine):
    root = deepcopy(source)
    root.find(tag('defs')).extend(deepcopy(list(parts.find(tag('defs')))))
    if outfit == 'base':
        for child in list(root):
            if child.tag == tag('g'):
                root.remove(child)
        root.append(deepcopy(named(source, 'ground')))
        if feminine:
            root.append(deepcopy(named(parts, 'feminine-back-hair')))
        body = deepcopy(named(parts, 'base-body'))
        if feminine:
            body.set('transform', 'translate(280 0) scale(.97 1) translate(-280 0)')
        root.append(body)
        root.append(deepcopy(named(source, 'frontal-face')))
        root.append(deepcopy(named(source, 'tidy-hair')))
        named(root, 'face').set('viewBox', '219 86 122 159')
        named(root, 'materials').set('viewBox', '193 237 174 278')
        root.remove(named(root, 'lantern'))
    if feminine:
        named(root, 'face-outline').set('d', 'M280 104C255 104 241 124 239 150C237 167 242 181 249 193C255 203 264 211 273 214Q280 217 287 214C296 211 305 203 311 193C318 181 323 167 321 150C319 124 305 104 280 104Z')
        named(root, 'face-volume').set('opacity', '.08')
        named(root, 'eyebrow-shape').set('d', 'M248 140C254 136 261 136 269 140L268 141.5C261 138.5 254 139 249 142Z')
        named(root, 'lower-lip').set('opacity', '.64')
        old = named(root, 'tidy-hair')
        index = list(root).index(old)
        root.remove(old)
        root.insert(index, deepcopy(named(parts, 'feminine-front-hair')))
    label = ('Personnage féminin' if feminine else 'Personnage masculin')
    root.find(tag('title')).text = f'{label} 2.0 — ' + ('base neutre' if outfit == 'base' else 'tenue de rôdeur')
    root.find(tag('desc')).text = (f'{label} debout de face, visage naturel, cheveux châtains. ' +
        ('Haut simple vert grisé, pantalon ardoise et chaussures sobres. Sans équipement, capuche, cape ni accessoire.' if outfit == 'base' else
         'Capuche verte, cape, cuir cousu, sacoche et lanterne en laiton.'))
    root.find(tag('metadata')).text = 'Original Class Odyssey 2.0 SVG. Exported from ranger-vector.svg and tools/svg/base-parts.svg by tools/svg/build-character-variants.py. Native editable paths; no bitmap or external dependency. Outfit=' + outfit + '; feminine=' + str(feminine).lower()
    prune_defs(root)
    filename = ('character-base-female.svg' if feminine else 'character-base-male.svg') if outfit == 'base' else 'ranger-feminine.svg'
    ET.indent(root, space='  ')
    ET.ElementTree(root).write(OUT / filename, encoding='utf-8', xml_declaration=False)
    print(f'Exported {filename}')


for options in [('base', False), ('base', True), ('ranger', True)]:
    export(*options)
