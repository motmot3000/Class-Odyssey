import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { visiblePart, HAIR_PALETTE, EYE_PALETTE, CATALOGUE_REVISION, PETS_CATALOGUE_URL, SKIN_TONE_COLORS, SKIN_TONE_NEUTRAL } from './items-3d-model.mjs';
import { renderPortraitImage } from './portrait-image.mjs';

// Eye colours re-tint the delivered iris map in plain sRGB: every coloured
// pixel keeps its natural shading (its luminance) but takes the target hue, so
// the pupil, limbal ring and catchlight survive and the iris still reads as a
// real eye rather than a flat wash. One texture is baked per colour.
const irisTextures = new Map();
// Mid-luminance of the delivered iris; pixels around it land exactly on the
// target colour, brighter fibres lighten and the shaded rim darkens.
const IRIS_REFERENCE_LUMA = 0.30;
function srgbFromHex(hex) {
  const value = Number.parseInt(hex.replace('#', ''), 16);
  return { r: ((value >> 16) & 255) / 255, g: ((value >> 8) & 255) / 255, b: (value & 255) / 255 };
}
function recolorIris(source, hex) {
  if (!source?.image || typeof document === 'undefined') return null;
  const key = `${source.uuid}|${hex}`;
  if (irisTextures.has(key)) return irisTextures.get(key);
  const size = source.image.width || 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(source.image, 0, 0, size, size);
  const image = context.getImageData(0, 0, size, size);
  const data = image.data;
  const target = srgbFromHex(hex);
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const lightness = (max + min) / 2;
    const saturation = max === min ? 0 : (max - min) / (1 - Math.abs(2 * lightness - 1));
    // Leave the pupil (dark), the catchlight (white) and the sclera alone.
    if (saturation <= 0.18 || lightness <= 0.12 || lightness >= 0.90) continue;
    const ratio = Math.min(1.25, Math.max(0.4, (0.299 * r + 0.587 * g + 0.114 * b) / IRIS_REFERENCE_LUMA));
    data[i] = Math.min(255, Math.round(target.r * ratio * 255));
    data[i + 1] = Math.min(255, Math.round(target.g * ratio * 255));
    data[i + 2] = Math.min(255, Math.round(target.b * ratio * 255));
  }
  context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = source.flipY;
  texture.wrapS = source.wrapS;
  texture.wrapT = source.wrapT;
  irisTextures.set(key, texture);
  return texture;
}

// The single baked body is multiplied by the target skin tone. Ratios are
// computed in linear working space so the result matches the tone palette.
const skinTints = new Map();
function skinTint(tone) {
  const key = SKIN_TONE_COLORS[tone] ? tone : SKIN_TONE_NEUTRAL;
  if (!skinTints.has(key)) {
    const neutral = new THREE.Color(SKIN_TONE_COLORS[SKIN_TONE_NEUTRAL]);
    const target = new THREE.Color(SKIN_TONE_COLORS[key]);
    skinTints.set(key, new THREE.Color(target.r / neutral.r, target.g / neutral.g, target.b / neutral.b));
  }
  return skinTints.get(key);
}

function disposeModel(model) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  model?.traverse(obj => {
    if (obj.geometry) geometries.add(obj.geometry);
    for (const mat of (Array.isArray(obj.material) ? obj.material : [obj.material]).filter(Boolean)) materials.add(mat);
  });
  for (const material of materials) for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
  geometries.forEach(geometry => geometry.dispose());
  materials.forEach(material => material.dispose());
  textures.forEach(texture => texture.dispose());
}

export async function createItemsViewer(container, initialLook, { onProgress, onError, onFreeView, modelURL = `/assets/items-3d/catalogue.glb?v=${CATALOGUE_REVISION}`, theme = 'light' } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, .02, 30);
  const room = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(room, .04);
  scene.environment = environment.texture;
  scene.environmentIntensity = .65;
  room.dispose(); pmrem.dispose();
  const hemi = new THREE.HemisphereLight(0xfff7e6, 0xb0bea5, .9);
  scene.add(hemi);
  const lights = [[0xffeed6, 2.4, [-3, 6, 4]], [0xe4eeff, 1.3, [3, 2, -2]], [0xfff5e8, .7, [2, 2, 4]]].map(([color, intensity, position]) => {
    const light = new THREE.DirectionalLight(color, intensity);
    light.position.set(...position); scene.add(light);
    return light;
  });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(.68, 64), new THREE.MeshBasicMaterial({ color: 0x829377, transparent: true, opacity: .065, depthWrite: false }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -.008; scene.add(ground);
  // Both themes share the same lighting layout; light is the reference rig.
  const THEMES = {
    light: {
      exposure: 1.02, env: .65, hemi: { color: 0xfff7e6, ground: 0xb0bea5, intensity: .9 },
      lights: [[0xffeed6, 2.4], [0xe4eeff, 1.3], [0xfff5e8, .7]],
      ground: { color: 0x829377, opacity: .065 }
    },
    dark: {
      exposure: 1.12, env: .5, hemi: { color: 0xdff4ff, ground: 0x14242e, intensity: .6 },
      lights: [[0xcfe9f2, 1.95], [0xffb765, 1.9], [0x6fe6ff, .5]],
      ground: { color: 0x2b4a55, opacity: .16 }
    }
  };
  let model;
  try {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(modelURL, event => { if (event.total) onProgress?.(Math.round(event.loaded / event.total * 90)); });
    model = gltf.scene;
    // Load once alongside the hero: all subsequent previews and snapshots are
    // synchronous, including switching pets while a portrait is being baked.
    const pets = await loader.loadAsync(PETS_CATALOGUE_URL);
    model.add(pets.scene);
    onProgress?.(100);
  } catch (error) { disposeModel(model); environment.dispose(); ground.geometry.dispose(); ground.material.dispose(); renderer.dispose(); throw error; }
  scene.add(model);
  model.userData.source_credit = 'Noa/Mila — characters-base, base-v2-2026-09, test-modelisation. Source morphology: Nintendo / The Models Resource — Trikeboy. Welded bases and anchor-fitted equipment: Class Odyssey study.';
  let look = { ...initialLook };
  let angle = 'quarter';
  let yaw = .55;
  let rotating = false;
  let active = true;
  let lost = false;
  let disposed = false;
  let frame;
  let lastTime = 0;
  const target = new THREE.Vector3(0, 1.02, 0);
  let distance = 4.8;
  let elevation = .23;
  let previewSize = null;
  const views = {
    front: { yaw: 0, target: [0, 1.02, 0], distance: 4.8, elevation: .18 },
    quarter: { yaw: .55, target: [0, 1.02, 0], distance: 4.8, elevation: .23 },
    back: { yaw: Math.PI, target: [0, 1.02, 0], distance: 4.8, elevation: .22 },
    head: { yaw: .10, target: [0, 1.77, 0], distance: 1.42, elevation: .05 },
    item: { yaw: .10, target: [0, 1, 0], distance: 2.5, elevation: .09 }
  };
  function placeCamera() {
    const d = previewSize
      ? Math.max(previewSize.y/2, Math.hypot(previewSize.x, previewSize.z)/(2*camera.aspect)) / Math.tan(THREE.MathUtils.degToRad(camera.fov/2)) * 1.18 + previewSize.length()*.2
      : distance * Math.max(1, .82 / camera.aspect);
    camera.position.set(target.x + Math.sin(yaw) * d, target.y + elevation, target.z + Math.cos(yaw) * d);
    camera.lookAt(target);
  }
  function draw(time = 0) {
    frame = undefined;
    if (!active || lost) return;
    if (rotating) { yaw += Math.min(lastTime ? (time - lastTime) / 1000 : 0, .05) * .27; lastTime = time; }
    placeCamera(); renderer.render(scene, camera);
    if (rotating) frame = requestAnimationFrame(draw);
  }
  function requestDraw() { if (!frame && active && !lost) frame = requestAnimationFrame(draw); }
  function counts() {
    let pieces = 0, triangles = 0;
    model.traverseVisible(obj => { if (obj.isMesh) { pieces++; triangles += (obj.geometry.index?.count || obj.geometry.attributes.position.count) / 3; } });
    return { pieces, triangles: Math.round(triangles) };
  }
  function applyLook(next) {
    const wasPreview = Boolean(look.preview);
    const petChanged = look.pet !== next.pet;
    look = { ...next };
    const tint = skinTint(look.tone);
    ground.visible = !look.preview;
    model.userData.game_of_more_loadout = { ...look };
    model.traverse(obj => {
      obj.visible = visiblePart(obj.userData, look);
      if (obj.isMesh) {
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const mat of materials) {
          if (!mat) continue;
          if (mat.name.startsWith('Hair /')) {
            mat.color.set(HAIR_PALETTE[look.hairColor] || HAIR_PALETTE['brown-hair']);
            if (mat.name.includes('shadow')) mat.color.multiplyScalar(.78);
            if (mat.name.includes('highlight')) mat.color.multiplyScalar(1.18);
            continue;
          }
          if (mat.name.toLowerCase().includes('iris')) {
            if (!mat.userData.irisSource) mat.userData.irisSource = mat.map;
            const tinted = recolorIris(mat.userData.irisSource, EYE_PALETTE[look.eyeColor] || EYE_PALETTE['brown-eyes']);
            if (tinted && mat.map !== tinted) { mat.map = tinted; mat.color.set(0xffffff); mat.needsUpdate = true; }
            continue;
          }
          if (!mat.userData?.base_skin_map && !mat.userData?.skin_plain) continue;
          if (!mat.userData.baseSkinColor) mat.userData.baseSkinColor = mat.color.clone();
          mat.color.copy(mat.userData.baseSkinColor).multiply(tint);
        }
      }
    });
    if (look.preview || wasPreview || petChanged || angle === 'item' || angle === 'head') setAngle(angle === 'free' ? 'quarter' : angle);
    requestDraw();
    return counts();
  }
  function setAngle(value) {
    if (!views[value]) value = 'quarter';
    if (look.preview && ['head', 'item'].includes(value)) value = 'quarter';
    angle = value; rotating = false; lastTime = 0;
    const preset = views[value];
    yaw = preset.yaw; target.set(...preset.target); distance = preset.distance; elevation = preset.elevation;
    previewSize = null;
    if (look.preview) {
      const bounds = new THREE.Box3();
      model.updateMatrixWorld(true);
      model.traverseVisible(obj => { if (obj.isMesh) bounds.expandByObject(obj, true); });
      if (!bounds.isEmpty()) {
        bounds.getCenter(target);
        previewSize = bounds.getSize(new THREE.Vector3());
        elevation = previewSize.y*.06;
      }
    } else if (value === 'item' || value === 'head') {
      const bounds = new THREE.Box3();
      const slots = value === 'head' ? ['persona', 'hair', 'hat'] : ['weapon', 'pet'];
      model.traverseVisible(obj => {
        if (!slots.includes(obj.userData.shop_slot)) return;
        if (value === 'head' && obj.userData.head_bounds_min) {
          const head = new THREE.Box3(new THREE.Vector3().fromArray(obj.userData.head_bounds_min), new THREE.Vector3().fromArray(obj.userData.head_bounds_max));
          bounds.union(head.applyMatrix4(model.matrixWorld));
        } else bounds.expandByObject(obj, true);
      });
      if (!bounds.isEmpty()) {
        bounds.getCenter(target);
        const size = bounds.getSize(new THREE.Vector3());
        distance = Math.max(value === 'head' ? 1.1 : 1.25, Math.max(size.y, size.x * .95) * 2.6);
      }
    }
    requestDraw();
  }
  function setRotation(value) { rotating = value; lastTime = 0; requestDraw(); }
  function setActive(value) {
    if (disposed) return;
    active = value;
    lastTime = 0;
    if (!value && frame) { cancelAnimationFrame(frame); frame = undefined; }
    if (value) requestDraw();
  }
  function setTheme(value) {
    const rig = THEMES[value] || THEMES.light;
    renderer.toneMappingExposure = rig.exposure;
    scene.environmentIntensity = rig.env;
    hemi.color.set(rig.hemi.color); hemi.groundColor.set(rig.hemi.ground); hemi.intensity = rig.hemi.intensity;
    lights.forEach((light, index) => { light.color.set(rig.lights[index][0]); light.intensity = rig.lights[index][1]; });
    ground.material.color.set(rig.ground.color); ground.material.opacity = rig.ground.opacity;
    requestDraw();
  }
  function resize() {
    const host = canvas.parentElement || container;
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
    // Resizing clears the drawing buffer. Repaint atomically, even while the
    // visibility observer is catching up with a viewport/orientation change.
    if (!lost) { placeCamera(); renderer.render(scene, camera); }
    requestDraw();
  }
  let pointer;
  const canvas = renderer.domElement;
  renderer.domElement.addEventListener('pointerdown', event => { pointer = { id: event.pointerId, x: event.clientX }; renderer.domElement.setPointerCapture(event.pointerId); });
  renderer.domElement.addEventListener('pointermove', event => {
    if (pointer?.id !== event.pointerId) return;
    const delta = event.clientX - pointer.x; pointer.x = event.clientX;
    if (Math.abs(delta) > .3) { rotating = false; angle = 'free'; yaw -= delta * .008; onFreeView?.(); requestDraw(); }
  });
  for (const type of ['pointerup', 'pointercancel']) renderer.domElement.addEventListener(type, () => { pointer = undefined; });
  renderer.domElement.addEventListener('webglcontextlost', event => { event.preventDefault(); lost = true; setActive(false); onError?.('La session 3D a été interrompue. Rechargez la page pour reprendre.'); });
  async function exportLook(itemsOnly = false) {
    const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
    try {
      model.traverse(obj => { obj.visible = visiblePart(obj.userData, look, itemsOnly); });
      model.updateMatrixWorld(true);
      return await new GLTFExporter().parseAsync(model, { binary: true, onlyVisible: true, trs: true, animations: [], maxTextureSize: 1024 });
    } finally { applyLook(look); }
  }
  applyLook(initialLook);
  setTheme(theme);
  container.append(canvas);
  const observer = new ResizeObserver(resize); observer.observe(canvas); resize();
  return {
    element: canvas,
    applyLook,
    setAngle,
    setRotation,
    setActive,
    setTheme,
    counts,
    resize,
    exportLook,
    snapshot() {
      if (lost || disposed) return null;
      const previousTarget=target.clone(), previousSize=previewSize, previousElevation=elevation;
      const wasGroundVisible=ground.visible;
      try {
        const bounds=new THREE.Box3();
        model.updateMatrixWorld(true);
        model.traverseVisible(obj=>{if(obj.isMesh) bounds.expandByObject(obj,true);});
        if (!bounds.isEmpty()) {
          bounds.getCenter(target);
          previewSize=bounds.getSize(new THREE.Vector3());
          if (!look.preview && look.pet && look.pet !== 'no-pet') {
            // A companion must not pull the hero off the portrait's centreline.
            target.x=target.z=0;
            previewSize.x=2*Math.max(Math.abs(bounds.min.x),Math.abs(bounds.max.x));
            previewSize.z=2*Math.max(Math.abs(bounds.min.z),Math.abs(bounds.max.z));
          }
          elevation=previewSize.y*.025;
        }
        ground.visible=false;
        placeCamera(); renderer.render(scene,camera);
        return renderPortraitImage(canvas, { centered: !look.preview && look.pet && look.pet !== 'no-pet' });
      } finally {
        target.copy(previousTarget); previewSize=previousSize; elevation=previousElevation;
        ground.visible=wasGroundVisible;
      }
    },
    destroy() {
      if (disposed) return;
      disposed = true;
      active = false;
      observer.disconnect();
      cancelAnimationFrame(frame);
      disposeModel(model);
      environment.dispose(); ground.geometry.dispose(); ground.material.dispose();
      renderer.dispose();
      canvas.remove();
    }
  };
}
