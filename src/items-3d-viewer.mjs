import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { visiblePart, HAIR_PALETTE } from './items-3d-model.mjs';

export async function createItemsViewer(container, initialLook, { onProgress, onError, onFreeView }) {
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
  scene.add(new THREE.HemisphereLight(0xfff7e6, 0xb0bea5, .9));
  for (const [color, intensity, position] of [[0xffeed6, 2.4, [-3, 6, 4]], [0xe4eeff, 1.3, [3, 2, -2]], [0xfff5e8, .7, [2, 2, 4]]]) {
    const light = new THREE.DirectionalLight(color, intensity);
    light.position.set(...position); scene.add(light);
  }
  const ground = new THREE.Mesh(new THREE.CircleGeometry(.68, 64), new THREE.MeshBasicMaterial({ color: 0x829377, transparent: true, opacity: .065, depthWrite: false }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -.008; scene.add(ground);
  let model;
  try {
    const gltf = await new GLTFLoader().loadAsync('/assets/items-3d/catalogue.glb', event => { if (event.total) onProgress(Math.round(event.loaded / event.total * 100)); });
    model = gltf.scene;
  } catch (error) { environment.dispose(); ground.geometry.dispose(); ground.material.dispose(); renderer.dispose(); throw error; }
  scene.add(model);
  model.userData.source_credit = 'Noa/Mila — characters-base, base-v2-2026-09, test-modelisation. Source morphology: Nintendo / The Models Resource — Trikeboy. Welded bases and anchor-fitted equipment: ClassQuest study.';
  let look = { ...initialLook };
  let angle = 'quarter';
  let yaw = .55;
  let rotating = false;
  let active = true;
  let lost = false;
  let frame;
  let lastTime = 0;
  const target = new THREE.Vector3(0, 1.02, 0);
  let distance = 4.8;
  let elevation = .23;
  const views = {
    front: { yaw: 0, target: [0, 1.02, 0], distance: 4.8, elevation: .18 },
    quarter: { yaw: .55, target: [0, 1.02, 0], distance: 4.8, elevation: .23 },
    back: { yaw: Math.PI, target: [0, 1.02, 0], distance: 4.8, elevation: .22 },
    head: { yaw: .10, target: [0, 1.77, 0], distance: 1.42, elevation: .05 },
    item: { yaw: .10, target: [0, 1, 0], distance: 2.5, elevation: .09 }
  };
  function placeCamera() {
    const d = distance * Math.max(1, .82 / camera.aspect);
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
    look = { ...next };
    model.userData.game_of_more_loadout = { ...look };
    model.traverse(obj => {
      obj.visible = visiblePart(obj.userData, look);
      if (obj.isMesh) {
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const mat of materials) {
          if (!mat.name.startsWith('Hair /')) continue;
          mat.color.set(HAIR_PALETTE[look.hairColor] || HAIR_PALETTE['brown-hair']);
          if (mat.name.includes('shadow')) mat.color.multiplyScalar(.78);
          if (mat.name.includes('highlight')) mat.color.multiplyScalar(1.18);
        }
      }
    });
    if (angle === 'item' || angle === 'head') setAngle(angle);
    requestDraw();
    return counts();
  }
  function setAngle(value) {
    angle = value; rotating = false; lastTime = 0;
    const preset = views[value];
    yaw = preset.yaw; target.set(...preset.target); distance = preset.distance; elevation = preset.elevation;
    if (value === 'item' || value === 'head') {
      const bounds = new THREE.Box3();
      const slots = value === 'head' ? ['persona', 'hair', 'hat'] : ['weapon'];
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
  function setActive(value) { active = value; lastTime = 0; if (!value && frame) { cancelAnimationFrame(frame); frame = undefined; } if (value) requestDraw(); }
  function resize() {
    const { width, height } = container.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
    // Resizing clears the drawing buffer. Repaint atomically, even while the
    // visibility observer is catching up with a viewport/orientation change.
    if (!lost) { placeCamera(); renderer.render(scene, camera); }
    requestDraw();
  }
  let pointer;
  renderer.domElement.addEventListener('pointerdown', event => { pointer = { id: event.pointerId, x: event.clientX }; renderer.domElement.setPointerCapture(event.pointerId); });
  renderer.domElement.addEventListener('pointermove', event => {
    if (pointer?.id !== event.pointerId) return;
    const delta = event.clientX - pointer.x; pointer.x = event.clientX;
    if (Math.abs(delta) > .3) { rotating = false; angle = 'free'; yaw -= delta * .008; onFreeView(); requestDraw(); }
  });
  for (const type of ['pointerup', 'pointercancel']) renderer.domElement.addEventListener(type, () => { pointer = undefined; });
  renderer.domElement.addEventListener('webglcontextlost', event => { event.preventDefault(); lost = true; setActive(false); onError('La session 3D a été interrompue. Rechargez la page pour reprendre.'); });
  async function exportLook(itemsOnly = false) {
    const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
    try {
      model.traverse(obj => { obj.visible = visiblePart(obj.userData, look, itemsOnly); });
      model.updateMatrixWorld(true);
      return await new GLTFExporter().parseAsync(model, { binary: true, onlyVisible: true, trs: true, animations: [], maxTextureSize: 1024 });
    } finally { applyLook(look); }
  }
  applyLook(initialLook);
  container.append(renderer.domElement);
  const observer = new ResizeObserver(resize); observer.observe(container); resize();
  return { applyLook, setAngle, setRotation, setActive, counts, exportLook };
}
