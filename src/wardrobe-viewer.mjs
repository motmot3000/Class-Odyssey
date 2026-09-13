import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export async function createWardrobeViewer(container, initialState, { onProgress, onError, onFreeView }) {
  const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true, powerPreference:'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, .02, 30);
  const environment = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(environment, .04);
  scene.environment = env.texture; scene.environmentIntensity = .55;
  environment.dispose(); pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xfff7e4, 0xb6c6aa, .8));
  function light(color, intensity, position) { const l = new THREE.DirectionalLight(color,intensity);l.position.set(...position);scene.add(l);return l; }
  const key = light(0xffefd9, 2.2, [-3,6,4]);key.castShadow=true;
  key.shadow.mapSize.set(1024,1024);key.shadow.normalBias=.008;
  key.shadow.camera.left=key.shadow.camera.bottom=-1.7;key.shadow.camera.right=key.shadow.camera.top=1.7;
  light(0xe7f1ff,1.15,[3,2,-2]); light(0xfff5e8,.65,[2,1.5,4]);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.ShadowMaterial({opacity:.06}));
  ground.rotation.x=-Math.PI/2;ground.position.y=-.004;ground.receiveShadow=true;scene.add(ground);
  let gltf;
  try { gltf=await new GLTFLoader().loadAsync('/assets/wardrobe/wardrobe.glb',event=>{if(event.total)onProgress(Math.round(event.loaded/event.total*100));}); }
  catch(error) {env.dispose();renderer.dispose();throw error;}
  const model=gltf.scene;
  model.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(model,true);
  const factor=1.80/box.getSize(new THREE.Vector3()).y;
  model.scale.multiplyScalar(factor);model.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(model,true);
  model.position.y-=bounds.min.y;
  model.traverse(object=>{if(object.isMesh){object.castShadow=object.receiveShadow=true;}});
  scene.add(model);
  let state={...initialState};let angle='quarter';let yaw=.28;let targetY=.91;let distance=4.2;let elevation=.20;
  let rotating=false;let visible=true;let frame;let lastTime=0;let lost=false;
  const dyes={sage:'#80998d',mist:'#718999',sand:'#b8a586'};
  const presets={front:{yaw:0,target:.91,distance:4.2,elevation:.17},quarter:{yaw:.28,target:.91,distance:4.2,elevation:.20},back:{yaw:Math.PI,target:.91,distance:4.2,elevation:.20},outfit:{yaw:.12,target:1.13,distance:2.45,elevation:.10},face:{yaw:.1,target:1.605,distance:1.23,elevation:.035}};
  function placeCamera() {const d=distance*Math.max(1,.80/camera.aspect);camera.position.set(Math.sin(yaw)*d,targetY+elevation,Math.cos(yaw)*d);camera.lookAt(0,targetY,0);}
  function draw(time=0) {frame=undefined;if(!visible||lost)return;if(rotating){const dt=lastTime?Math.min((time-lastTime)/1000,.05):0;lastTime=time;yaw+=dt*.27;}placeCamera();renderer.render(scene,camera);if(rotating)frame=requestAnimationFrame(draw);}
  function requestDraw(){if(!frame&&visible&&!lost)frame=requestAnimationFrame(draw);}
  function effectiveVisible(object){for(let node=object;node;node=node.parent)if(!node.visible)return false;return true;}
  function counts(){let pieces=0,triangles=0;model.traverse(o=>{if(o.isMesh&&effectiveVisible(o)){pieces++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;}});return {pieces,triangles:Math.round(triangles)};}
  function applyState(next){state={...next};model.userData.wardrobe_state=state;model.traverse(object=>{const slot=object.userData.wardrobe_slot;const value=object.userData.wardrobe_variant;if(slot)object.visible=slot==='core'||(slot==='pack'?(state.pack&&value==='on'):state[slot]===value);if(object.isMesh){for(const material of Array.isArray(object.material)?object.material:[object.material]){if(material?.name.startsWith('Dye'))material.color.set(dyes[state.dye]);}}});requestDraw();return counts();}
  function setAngle(value){angle=value;rotating=false;lastTime=0;({yaw,target:targetY,distance,elevation}=presets[value]);requestDraw();}
  function setRotation(value){rotating=value;lastTime=0;requestDraw();}
  function setVisible(value){visible=value;if(!value&&frame){cancelAnimationFrame(frame);frame=undefined;}if(value)requestDraw();}
  function resize(){const {width,height}=container.getBoundingClientRect();if(!width||!height)return;renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();requestDraw();}
  let pointer;
  renderer.domElement.addEventListener('pointerdown',event=>{pointer={id:event.pointerId,x:event.clientX};renderer.domElement.setPointerCapture(event.pointerId);});
  renderer.domElement.addEventListener('pointermove',event=>{if(pointer?.id!==event.pointerId)return;const delta=event.clientX-pointer.x;pointer.x=event.clientX;if(Math.abs(delta)>.3){rotating=false;yaw-=delta*.008;angle='free';onFreeView();requestDraw();}});
  function release(){pointer=undefined;}
  renderer.domElement.addEventListener('pointerup',release);renderer.domElement.addEventListener('pointercancel',release);
  renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();lost=true;setVisible(false);onError('La session 3D a été interrompue. Rechargez la page pour retrouver le vestiaire.');});
  async function exportLook(){const {GLTFExporter}=await import('three/addons/exporters/GLTFExporter.js');model.updateMatrixWorld(true);model.userData.source_credit='Source morphology: Nintendo / The Models Resource — Trikeboy. Wardrobe adaptation: ClassQuest prototype.';return new GLTFExporter().parseAsync(model,{binary:true,onlyVisible:true,trs:true,animations:[],maxTextureSize:1024});}
  applyState(initialState);
  container.append(renderer.domElement);
  const observer=new ResizeObserver(resize);observer.observe(container);resize();
  return {applyState,setAngle,setRotation,setVisible,exportLook,counts,scene:model};
}
