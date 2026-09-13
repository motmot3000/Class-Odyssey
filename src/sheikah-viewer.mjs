import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const DYES = { sage: '#80998d', mist: '#718999', sand: '#b8a586' };

export async function createHeroViewer(container, glbUrl, initialState, { onProgress, onError, onFreeView, theme = 'dark' } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.02, 30);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = env.texture;
  scene.environmentIntensity = 0.5;
  pmrem.dispose();

  const hemi = new THREE.HemisphereLight(0xdff4ff, 0x14242e, 0.6);
  scene.add(hemi);

  const light = (color, intensity, position) => {
    const l = new THREE.DirectionalLight(color, intensity);
    l.position.set(...position);
    scene.add(l);
    return l;
  };
  const key = light(0xcfe9f2, 1.85, [-3, 6, 4]);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.normalBias = 0.008;
  key.shadow.camera.left = key.shadow.camera.bottom = -1.7;
  key.shadow.camera.right = key.shadow.camera.top = 1.7;
  const warm = light(0xffb765, 1.9, [3.4, 2.2, -1.8]);
  const fill = light(0xfff3e0, 0.55, [0.4, 2.2, 5]);
  const rim = light(0x6fe6ff, 0.5, [-2.6, 1.4, -3.2]);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ opacity: 0.16 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.004;
  ground.receiveShadow = true;
  scene.add(ground);

  const RIGS = {
    dark:  { exposure: 1.12, env: 0.5,  hemi: 0.6, key: 1.85, warm: 1.9, fill: 0.55, rim: 0.5,  shadow: 0.16 },
    light: { exposure: 1.0,  env: 0.9,  hemi: 1.0, key: 1.45, warm: 1.0, fill: 0.7,  rim: 0.2,  shadow: 0.26 }
  };
  function setTheme(value) {
    const rig = RIGS[value] || RIGS.dark;
    renderer.toneMappingExposure = rig.exposure;
    scene.environmentIntensity = rig.env;
    hemi.intensity = rig.hemi;
    key.intensity = rig.key;
    warm.intensity = rig.warm;
    fill.intensity = rig.fill;
    rim.intensity = rig.rim;
    ground.material.opacity = rig.shadow;
    requestDraw();
  }

  let gltf;
  try {
    gltf = await new GLTFLoader().loadAsync(glbUrl, (event) => {
      if (event.total) onProgress?.(Math.round((event.loaded / event.total) * 100));
    });
  } catch (error) {
    env.dispose();
    renderer.dispose();
    throw error;
  }

  const model = gltf.scene;
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model, true);
  model.scale.multiplyScalar(1.80 / box.getSize(new THREE.Vector3()).y);
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model, true);
  model.position.y -= bounds.min.y;
  model.traverse((object) => {
    if (object.isMesh) object.castShadow = object.receiveShadow = true;
  });
  scene.add(model);
  model.updateMatrixWorld(true);
  const placed = new THREE.Box3().setFromObject(model, true);
  const top = placed.max.y || 1.8;

  // Cadrages dérivés de la taille réelle du modèle : le zoom reste juste
  // quels que soient le personnage et la tenue.
  const presets = {
    front:   { yaw: 0,       target: top * 0.50, distance: 4.2,  elevation: 0.12 },
    quarter: { yaw: 0.28,    target: top * 0.50, distance: 4.2,  elevation: 0.18 },
    back:    { yaw: Math.PI, target: top * 0.50, distance: 4.2,  elevation: 0.18 },
    outfit:  { yaw: 0.14,    target: top * 0.56, distance: 3.2,  elevation: 0.05 },
    face:    { yaw: 0.10,    target: top * 0.93, distance: 1.3,  elevation: 0.0 }
  };

  let state = { ...initialState };
  let { yaw, target: targetY, distance, elevation } = presets.quarter;
  let rotating = false;
  let visible = true;
  let frame;
  let lastTime = 0;
  let lost = false;

  function placeCamera() {
    const d = distance * Math.max(1, 0.80 / camera.aspect);
    camera.position.set(Math.sin(yaw) * d, targetY + elevation, Math.cos(yaw) * d);
    camera.lookAt(0, targetY, 0);
  }

  function draw(time = 0) {
    frame = undefined;
    if (!visible || lost) return;
    if (rotating) {
      const dt = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 0;
      lastTime = time;
      yaw += dt * 0.27;
    }
    placeCamera();
    renderer.render(scene, camera);
    if (rotating) frame = requestAnimationFrame(draw);
  }
  function requestDraw() {
    if (!frame && visible && !lost) frame = requestAnimationFrame(draw);
  }
  function effectiveVisible(object) {
    for (let node = object; node; node = node.parent) if (!node.visible) return false;
    return true;
  }
  function counts() {
    let pieces = 0;
    let triangles = 0;
    model.traverse((o) => {
      if (o.isMesh && effectiveVisible(o)) {
        pieces++;
        triangles += (o.geometry.index?.count || o.geometry.attributes.position.count) / 3;
      }
    });
    return { pieces, triangles: Math.round(triangles) };
  }
  function applyState(next) {
    state = { ...next };
    model.traverse((object) => {
      const slot = object.userData.wardrobe_slot;
      const value = object.userData.wardrobe_variant;
      if (slot) {
        object.visible =
          slot === 'core' || (slot === 'pack' ? Boolean(state.pack) && value === 'on' : state[slot] === value);
      }
      if (object.isMesh) {
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          if (material?.name.startsWith('Dye')) material.color.set(DYES[state.dye] || DYES.sage);
        }
      }
    });
    requestDraw();
    return counts();
  }
  function setAngle(value) {
    rotating = false;
    lastTime = 0;
    const preset = presets[value] || presets.quarter;
    ({ yaw, target: targetY, distance, elevation } = preset);
    requestDraw();
  }
  function setRotation(value) {
    rotating = value;
    lastTime = 0;
    requestDraw();
  }
  function setVisible(value) {
    visible = value;
    if (!value && frame) {
      cancelAnimationFrame(frame);
      frame = undefined;
    }
    if (value) requestDraw();
  }
  function resize() {
    const host = canvas.parentElement || container;
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    requestDraw();
  }

  let pointer;
  const canvas = renderer.domElement;
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Aperçu 3D du héros. Utilisez les flèches gauche et droite pour le faire pivoter.');
  canvas.addEventListener('pointerdown', (event) => {
    pointer = { id: event.pointerId, x: event.clientX };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (pointer?.id !== event.pointerId) return;
    const delta = event.clientX - pointer.x;
    pointer.x = event.clientX;
    if (Math.abs(delta) > 0.3) {
      rotating = false;
      yaw -= delta * 0.008;
      onFreeView?.();
      requestDraw();
    }
  });
  const release = () => { pointer = undefined; };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    rotating = false;
    yaw += event.key === 'ArrowLeft' ? -0.14 : 0.14;
    onFreeView?.();
    requestDraw();
  });
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    lost = true;
    setVisible(false);
    onError?.('La liaison à l’artefact a été interrompue. Rechargez la page.');
  });

  applyState(initialState);
  setTheme(theme);
  container.append(canvas);
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();

  return {
    element: canvas,
    applyState,
    setAngle,
    setRotation,
    setVisible,
    setTheme,
    counts,
    resize,
    destroy() {
      observer.disconnect();
      cancelAnimationFrame(frame);
      renderer.dispose();
      canvas.remove();
    }
  };
}
