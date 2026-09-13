import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// Loaded only when a portrait is opened: the comparison stays inexpensive.
export async function createViewer(container, { onProgress, onError, modelURL = '/assets/character-lab/ranger.glb', label = 'du rôdeur', studio = 'night' }) {
  const daylight = studio === 'daylight';
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = daylight ? 1.1 : 1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const environment = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(environment, .04);
  scene.environment = env.texture;
  scene.environmentIntensity = daylight ? .75 : .5;
  environment.dispose();
  pmrem.dispose();
  const camera = new THREE.PerspectiveCamera(30, 1, .01, 30);
  const rig = new THREE.Group();
  scene.add(rig);
  scene.add(new THREE.HemisphereLight(daylight ? 0xfff8e5 : 0xd7e8ff, daylight ? 0xc6cfb0 : 0x2b2922, daylight ? .75 : 1.1));
  function light(color, intensity, position) {
    const source = new THREE.DirectionalLight(color, intensity);
    source.position.set(...position);
    scene.add(source);
    return source;
  }
  const key = light(daylight ? 0xffefd6 : 0xffe0b5, daylight ? 2.4 : 2.6, [-2, 3, 4]);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = key.shadow.camera.bottom = -1.6;
  key.shadow.camera.right = key.shadow.camera.top = 1.6;
  key.shadow.normalBias = .012;
  light(daylight ? 0xe4f1ff : 0xb1d6ff, daylight ? 1.2 : 1.5, [3, 2, -2]);
  light(daylight ? 0xfff5e4 : 0xc7def6, daylight ? .85 : .65, [2, 1, 4]);
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(.53, .55, .055, 80), new THREE.MeshStandardMaterial({ color: daylight ? 0xd3dcc6 : 0x283a40, roughness: .83, metalness: daylight ? .02 : .12 }));
  plinth.position.y = -.029;
  plinth.receiveShadow = true;
  scene.add(plinth);
  let gltf;
  try {
    gltf = await new GLTFLoader().loadAsync(modelURL, event => {
      if (event.total) onProgress(Math.round(event.loaded / event.total * 100));
    });
  } catch (error) {
    env.dispose(); renderer.dispose();
    throw error;
  }
  const model = gltf.scene;
  const initialBox = new THREE.Box3().setFromObject(model);
  const scale = 1.75 / initialBox.getSize(new THREE.Vector3()).y;
  model.scale.multiplyScalar(scale);
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.add(new THREE.Vector3(-center.x, -box.min.y, -center.z));
  let triangles = 0;
  model.traverse(object => {
    if (!object.isMesh) return;
    object.castShadow = object.receiveShadow = true;
    triangles += (object.geometry.index?.count || object.geometry.attributes.position.count) / 3;
  });
  rig.add(model);
  container.append(renderer.domElement);
  container.querySelector('.viewer-fallback').hidden = true;
  let visible = true;
  let rotating = false;
  let angle = 'quarter';
  let lastTime = 0;
  let frame;
  const target = new THREE.Vector3(0, .88, 0);
  const angles = {
    front: { rotation: 0, target: .80, distance: 4.35, elevation: 1.17, label: 'vue de face' },
    quarter: { rotation: -.36, target: .80, distance: 4.35, elevation: 1.17, label: 'vue de trois quarts' },
    back: { rotation: Math.PI, target: .80, distance: 4.35, elevation: 1.17, label: 'vue de dos' },
    detail: { rotation: -.16, target: 1.42, distance: 1.8, elevation: 1.53, label: 'détail du visage et des matières' }
  };
  function resize() {
    const { width, height } = container.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    placeCamera();
    render();
  }
  function placeCamera() {
    const preset = angles[angle];
    const factor = Math.max(1, .78 / camera.aspect);
    camera.position.set(0, preset.elevation, preset.distance * factor);
    target.set(0, preset.target, 0);
    camera.lookAt(target);
  }
  function render() { if (visible) renderer.render(scene, camera); }
  function animate(time) {
    if (!visible || !rotating) { frame = undefined; return; }
    const delta = lastTime ? Math.min((time - lastTime) / 1000, .05) : 0;
    lastTime = time;
    rig.rotation.y += delta * .28;
    render();
    frame = requestAnimationFrame(animate);
  }
  function setRotation(value) {
    rotating = value;
    lastTime = 0;
    if (frame) cancelAnimationFrame(frame);
    frame = undefined;
    if (rotating && visible) frame = requestAnimationFrame(animate);
    render();
  }
  function setAngle(value) {
    angle = value;
    setRotation(false);
    rig.rotation.y = angles[angle].rotation;
    container.setAttribute('aria-label', `Modèle 3D ${label}, ${angles[angle].label}`);
    placeCamera();
    render();
  }
  function setVisible(value) {
    visible = value;
    if (value) resize();
    setRotation(rotating);
  }
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  renderer.domElement.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    setVisible(false);
    container.querySelector('.viewer-fallback').hidden = false;
    onError('Le contexte 3D a été interrompu. Rechargez la page pour le rétablir.');
  });
  setAngle('quarter');
  resize();
  return { setAngle, setRotation, setVisible, triangles: Math.round(triangles) };
}
