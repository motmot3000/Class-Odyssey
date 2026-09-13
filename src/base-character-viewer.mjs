import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const modelBuffers = new Map();

async function modelBytes(url) {
  if (!modelBuffers.has(url)) {
    const request = fetch(url).then(response => {
      if (!response.ok) throw new Error(`Character model returned ${response.status}`);
      return response.arrayBuffer();
    }).catch(error => { modelBuffers.delete(url); throw error; });
    modelBuffers.set(url, request);
  }
  return modelBuffers.get(url);
}

function releaseModel(model) {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  model?.traverse(object => {
    if (object.geometry) geometries.add(object.geometry);
    for (const material of [].concat(object.material || [])) materials.add(material);
  });
  for (const material of materials) {
    for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    material.dispose();
  }
  for (const geometry of geometries) geometry.dispose();
  for (const texture of textures) { texture.dispose(); texture.image?.close?.(); }
}

export async function createBaseViewer(container, { url, signal, onContextLost }) {
  const bytes = await modelBytes(url);
  if (signal.aborted) throw new DOMException("Closed", "AbortError");
  let gltf;
  try { gltf = await new GLTFLoader().parseAsync(bytes.slice(0), new URL(".", url).href); }
  catch (error) { modelBuffers.delete(url); throw error; }
  if (signal.aborted) { releaseModel(gltf.scene); throw new DOMException("Closed", "AbortError"); }
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" }); }
  catch (error) { releaseModel(gltf.scene); throw error; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, .02, 30);
  const environment = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(environment, .04);
  scene.environment = env.texture;
  scene.environmentIntensity = .6;
  environment.dispose(); pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xe5efff, 0x5e6357, 1.0));
  for (const [color, intensity, position] of [[0xffe6c4, 2.2, [-2,3,4]], [0xc3dcff, 1.3, [3,2,-2]], [0xf4f6ff, .8, [2,1.5,4]]]) {
    const light = new THREE.DirectionalLight(color, intensity);
    light.position.set(...position); scene.add(light);
  }
  const model = gltf.scene;
  scene.add(model);
  let disposed = false;
  let angle = "quarter";
  const presets = {
    front: { yaw: 0, target: .91, distance: 4.25, elevation: .12 },
    quarter: { yaw: .22, target: .91, distance: 4.25, elevation: .16 },
    back: { yaw: Math.PI, target: .91, distance: 4.25, elevation: .16 },
    outfit: { yaw: .12, target: 1.16, distance: 2.45, elevation: .08 },
    face: { yaw: .10, target: 1.60, distance: 1.18, elevation: .025 }
  };
  function render() {
    if (disposed) return;
    const preset = presets[angle];
    const distance = preset.distance * Math.max(1, .62 / camera.aspect);
    camera.position.set(Math.sin(preset.yaw)*distance, preset.target+preset.elevation, Math.cos(preset.yaw)*distance);
    camera.lookAt(0, preset.target, 0);
    renderer.render(scene, camera);
  }
  function resize() {
    if (disposed) return;
    const { width, height } = container.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width/height; camera.updateProjectionMatrix(); render();
  }
  function lost(event) { event.preventDefault(); renderer.domElement.hidden = true; onContextLost(); }
  renderer.domElement.addEventListener("webglcontextlost", lost);
  container.append(renderer.domElement);
  const observer = new ResizeObserver(resize); observer.observe(container); resize();
  return {
    setAngle(value) { if (presets[value]) { angle = value; render(); } },
    dispose() {
      if (disposed) return;
      disposed = true; observer.disconnect();
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      releaseModel(model); env.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    }
  };
}
