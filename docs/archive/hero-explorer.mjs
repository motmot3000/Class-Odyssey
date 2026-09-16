/* Explorer hero — refined vector, ~6.5 heads tall.
   Shapes are declared once as data so the same geometry can be emitted twice:
   filled for the drawing, and unfilled inside a <clipPath> so the shading
   overlays are confined to the silhouette. */

/* Reference implementation of the vector hero (v2, "explorateur").
 *
 * NOT wired into the app yet — the app still ships the old rounded-SVG avatars
 * in src/avatar.mjs. This file is the validated source for the figure shown in
 * docs/explorer-direction.html, kept here so the next session can build on it.
 *
 * See docs/HANDOFF.md for where this is going: the silhouette and the rendering
 * machinery stay, the costume is being retargeted from explorer to medieval
 * fantasy.
 *
 * How it works: every shape is declared once as data ({tag, attrs, fill}), then
 * emitted twice — filled for the drawing, and geometry-only inside a <clipPath>
 * so the two shading overlays (a shadow wedge on the right, a highlight wedge on
 * the left) are confined to the silhouette. That is why a new accessory picks up
 * the lighting for free: it only has to be added to the shape list.
 */

export const INK = "#2A2119";

export const TONES = {
  porcelain: { base: "#F0C9A4", dark: "#D5A47C", lite: "#FBDDC0", line: "#8A5C3C" },
  sable:     { base: "#DFAE7E", dark: "#BC8757", lite: "#F0C9A4", line: "#7A4B2C" },
  amber:     { base: "#C68A55", dark: "#A16A3A", lite: "#DFAE7E", line: "#63381C" },
  chestnut:  { base: "#9A6440", dark: "#77482B", lite: "#B98056", line: "#472817" },
  ebony:     { base: "#6B452F", dark: "#4C2E1E", lite: "#875A3F", line: "#2E1810" }
};

export const HAIRS = {
  chatain: { base: "#5E4230", dark: "#3F2B1D", lite: "#7C5A41", line: "#2A1B10" },
  noir:    { base: "#332C2E", dark: "#1E1A1C", lite: "#4D4346", line: "#141112" },
  blond:   { base: "#C9A05A", dark: "#9C7736", lite: "#E2BF80", line: "#6B4E1C" },
  auburn:  { base: "#8E4A2C", dark: "#6A331B", lite: "#AC6643", line: "#3F1C0D" }
};

/* Coats are muted and earthy — the palette does most of the "classe". */
export const COATS = {
  teal:  { label: "Sylve",   base: "#2F5B5C", dark: "#204143", lite: "#417577", line: "#152D2F" },
  rust:  { label: "Canyon",  base: "#8D4B2F", dark: "#673421", lite: "#A96745", line: "#43200F" },
  moss:  { label: "Fougère", base: "#4B5E35", dark: "#354424", lite: "#65794A", line: "#222D15" },
  plum:  { label: "Vesprée", base: "#5B3C55", dark: "#41293D", lite: "#76546F", line: "#2A1826" },
  slate: { label: "Ardoise", base: "#3E4B64", dark: "#2B3549", lite: "#56647F", line: "#1B2130" }
};

export const LINEN   = { base: "#D9C9A9", dark: "#B9A583", lite: "#EBDEC4", line: "#6E5F44" };
export const TROUSER = { base: "#7A6A52", dark: "#5B4E3C", lite: "#96866C", line: "#332C21" };
export const LEATHER = { base: "#6B4A2E", dark: "#4A3220", lite: "#8A6440", line: "#2A1B10" };
export const BRASS   = { base: "#C08A3E", dark: "#95672A", lite: "#DDAE68", line: "#5E3F14" };

/* ---------- shape helpers ---------- */

const p = (d, fill, o = {}) => ({ tag: "path", a: { d }, fill, ...o });
const e = (cx, cy, rx, ry, fill, o = {}) => ({ tag: "ellipse", a: { cx, cy, rx, ry }, fill, ...o });
const c = (cx, cy, r, fill, o = {}) => ({ tag: "circle", a: { cx, cy, r }, fill, ...o });

function attrs(a) {
  return Object.entries(a).map(([k, v]) => `${k}="${v}"`).join(" ");
}

function draw(s, stroke) {
  const line = s.noStroke ? "" : ` stroke="${INK}" stroke-width="${s.sw || stroke}" stroke-linejoin="round" stroke-linecap="round"`;
  return `<${s.tag} ${attrs(s.a)} fill="${s.fill}"${line}/>`;
}

function clipGeom(s) {
  return `<${s.tag} ${attrs(s.a)}/>`;
}

/* ---------- the figure ---------- */

export function explorerShapes(opt) {
  const T = TONES[opt.tone];
  const H = HAIRS[opt.hair];
  const C = COATS[opt.coat];
  const hat = opt.gear === "hat";

  const S = [];

  // --- back arm, behind the coat. Flat top at the coat's shoulder height so
  // sleeve and shoulder form one continuous tailored line — no puffed seam.
  S.push(p("M45,122 L66,109 L64,199 C64,206 58,211 54.5,211 C51,211 46,206 46,199 Z", C.dark));
  S.push({ tag: "rect", a: { x: 45, y: 190, width: 20, height: 13, rx: 4 }, fill: LEATHER.dark });
  S.push(c(55, 208, 9.5, T.dark));

  // --- legs (trousers), stance opened up so the boots never touch
  S.push(p("M70,180 L66,268 L92,268 L94,180 Z", TROUSER.base));
  S.push(p("M130,180 L134,268 L108,268 L106,180 Z", TROUSER.base));

  // boots — shaft emerges from under the coat hem
  S.push(p("M65,252 L62,342 C62,352 69,357 78,357 L88,357 C92,352 92,344 91,338 L92,252 Z", LEATHER.base));
  S.push(p("M108,252 L109,338 C108,344 108,352 112,357 L122,357 C131,357 138,352 138,342 L135,252 Z", LEATHER.dark));
  S.push(p("M59,342 L94,342 L94,358 C94,363 90,365 84,365 L69,365 C63,365 59,363 59,358 Z", "#3A2A1C"));
  S.push(p("M106,342 L141,342 L141,358 C141,363 137,365 131,365 L116,365 C110,365 106,363 106,358 Z", "#3A2A1C"));

  // --- torso: linen shirt under an open coat
  S.push(p("M70,104 C78,96 122,96 130,104 L128,180 L72,180 Z", LINEN.base));

  // coat body — shoulders sit inside the arms, waist nips, then it flares
  S.push(p("M64,112 C71,98 82,92 100,92 C118,92 129,98 136,112 L132,150 L135,182 L65,182 L68,150 Z", C.base));

  // front sleeve, mirrored
  S.push(p("M155,122 L134,109 L136,199 C136,206 142,211 145.5,211 C149,211 154,206 154,199 Z", C.base));
  S.push({ tag: "rect", a: { x: 135, y: 190, width: 20, height: 13, rx: 4 }, fill: LEATHER.base });

  // narrow shirt V at the throat, then notched lapels folding over it
  S.push(p("M92,96 L100,120 L108,96 Z", LINEN.base));
  S.push(p("M84,94 L100,122 L93,126 L73,104 Z", C.dark));
  S.push(p("M116,94 L100,122 L107,126 L127,104 Z", C.lite));

  // stand-up collar hugging the neck
  S.push(p("M86,96 L99,90 L100,106 L83,110 Z", C.dark));
  S.push(p("M114,96 L101,90 L100,106 L117,110 Z", C.lite));

  // satchel strap across the chest
  S.push(p("M74,106 L85,100 L136,182 L125,189 Z", LEATHER.base));
  S.push(c(119, 170, 6.5, BRASS.base));

  // belt + pouch
  S.push(p("M64,176 L136,176 L136,196 L64,196 Z", LEATHER.dark));
  S.push(p("M90,173 L110,173 L110,199 L90,199 Z", BRASS.base));
  S.push(p("M112,196 L132,196 L129,220 L114,220 Z", LEATHER.base));

  // coat tails, split at the centre so the legs read through
  S.push(p("M66,192 C58,224 54,244 56,268 C70,272 84,273 96,272 L97,192 Z", C.dark));
  S.push(p("M134,192 C142,224 146,244 144,268 C130,272 116,273 104,272 L103,192 Z", C.base));

  // --- neck + head. Head is ~1/6 of the figure: adult proportions, not chibi.
  S.push(p("M90,66 L110,66 L110,100 L90,100 Z", T.dark));
  S.push(p("M100,24 C113,24 121,34 121,49 C121,63 112,75 100,79 C88,75 79,63 79,49 C79,34 87,24 100,24 Z", T.base));
  S.push(p("M80,52 C77,62 79,70 84,76 L88,72 C85,66 84,59 85,52 Z", T.dark, { noStroke: true }));

  // hair — volume on the crown, a swept fringe, a lock past the temple
  if (!hat) {
    if (opt.hairStyle === "longue") {
      S.push(p("M80,44 C71,72 69,112 74,144 L95,141 C88,112 85,74 87,46 Z", H.dark));
      S.push(p("M120,44 C129,72 131,112 126,144 L105,141 C112,112 115,74 113,46 Z", H.dark));
    } else if (opt.hairStyle === "queue") {
      S.push(p("M118,34 C136,44 142,70 134,96 L120,90 C127,68 124,48 112,40 Z", H.dark));
    }
    S.push(p("M79,54 C76,28 88,12 100,12 C113,12 126,28 122,54 C120,44 116,37 110,34 C100,30 90,36 86,46 C84,50 82,51 79,54 Z", H.base));
    S.push(p("M89,20 C96,16 106,17 112,21 C104,18 95,18 89,20 Z", H.lite, { noStroke: true }));
  } else {
    S.push(p("M80,48 C78,36 88,30 100,30 C112,30 122,36 120,48 Z", H.base));
  }

  // face
  S.push(e(92, 52, 2.7, 3.4, INK, { noStroke: true }));
  S.push(e(108, 52, 2.7, 3.4, INK, { noStroke: true }));
  S.push(c(93.1, 50.7, 1.1, "#FFFFFF", { noStroke: true }));
  S.push(c(109.1, 50.7, 1.1, "#FFFFFF", { noStroke: true }));
  S.push(p("M87,45 Q92,42.5 97,45", "none", { sw: 1.9, stroke: H.dark }));
  S.push(p("M103,45 Q108,42.5 113,45", "none", { sw: 1.9, stroke: H.dark }));
  S.push(p("M100,57 L100,62", "none", { sw: 1.6, stroke: T.line }));
  S.push(p("M96,68 Q100,70.5 104,68", "none", { sw: 1.9, stroke: T.line }));

  // hat
  if (hat) {
    S.push(p("M48,44 C64,30 136,30 152,44 C136,56 64,56 48,44 Z", LEATHER.base));
    S.push(p("M80,46 C78,20 88,12 100,12 C112,12 122,20 120,46 Z", LEATHER.base));
    S.push(p("M79,38 L121,38 L121,47 L79,47 Z", LEATHER.dark));
    S.push(c(115, 42, 4, BRASS.base));
  }

  // front hand sits on top of everything so it always reads as in front
  S.push(c(145, 208, 9.5, T.base));

  // lantern, hanging from the front hand
  if (opt.gear === "lantern") {
    S.push(p("M145,217 L145,229", "none", { sw: 2.5 }));
    S.push(p("M134,231 L158,231 L158,239 L134,239 Z", BRASS.dark));
    S.push(p("M136,239 L156,239 L159,273 L133,273 Z", "#F5DC9A"));
    S.push(p("M142,247 L150,247 L151,265 L141,265 Z", "#FFF4CF", { noStroke: true }));
    S.push(p("M132,273 L160,273 L163,283 L129,283 Z", BRASS.base));
  }

  return S;
}

/* ---------- render ---------- */

export function renderExplorer(opt) {
  const S = explorerShapes(opt);
  const stroke = opt.stroke ?? 2.2;
  const id = opt.id || "f";

  const body = S.map((s) => {
    if (s.stroke) {
      return `<${s.tag} ${attrs(s.a)} fill="${s.fill}" stroke="${s.stroke}" stroke-width="${s.sw || stroke}" stroke-linecap="round" fill-opacity="${s.fill === "none" ? 0 : 1}"/>`;
    }
    return draw(s, stroke);
  }).join("");

  let shading = "";
  if (opt.finish === "cel" || opt.finish === "shaded") {
    const soft = opt.finish === "shaded";
    shading = `
      <clipPath id="clip-${id}">${S.filter((s) => s.fill !== "none").map(clipGeom).join("")}</clipPath>
      <g clip-path="url(#clip-${id})">
        <path d="M112,0 L200,0 L200,390 L94,390 Z" fill="#160F0B" opacity="${soft ? 0.20 : 0.26}"/>
        <path d="M0,0 L58,0 L44,390 L0,390 Z" fill="#FFF6E6" opacity="${soft ? 0.20 : 0.16}"/>
        ${soft ? `<rect x="0" y="256" width="200" height="134" fill="#160F0B" opacity="0.14"/>` : ""}
      </g>`;
  }

  // A bust crop keeps the face legible on a small classroom card, where the
  // full figure shrinks to the point of losing every detail.
  const view = opt.crop === "bust" ? "46 2 108 146" : "0 0 200 390";
  const ground = opt.crop === "bust" ? ""
    : `<ellipse cx="100" cy="372" rx="52" ry="8" fill="${INK}" opacity="0.16"/>`;

  return `<svg viewBox="${view}" role="img" aria-label="${opt.alt || "héros explorateur"}">
    ${ground}
    ${body}
    ${shading}
  </svg>`;
}
