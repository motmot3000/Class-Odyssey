const defaults={gender:'male',outfit:'base',item:'none',pack:false,dye:'sage'};
let state={...defaults};let viewer;let pending;let angle='quarter';let rotating=false;let stageInView=true;
const names={male:'Noa',female:'Mila',base:'Essentiel',explorer:'Éclaireur',traveller:'Voyageur',none:'sans accessoire',satchel:'sacoche',lantern:'lanterne',sage:'Sauge',mist:'Brume',sand:'Sable'};
const viewNames={front:'vue de face',quarter:'vue de trois quarts',back:'vue de dos',outfit:'détail de la tenue',face:'détail du visage',free:'vue libre'};
const container=document.querySelector('#wardrobe-viewer');const poster=document.querySelector('#wardrobe-poster');const loading=document.querySelector('#loading-message');const retry=document.querySelector('#retry-load');const message=document.querySelector('#action-message');
function setReady(ready){document.querySelectorAll('[data-slot],[data-angle],#pack-toggle,#export-look,#reset-look,#rotate-look').forEach(control=>{control.disabled=!ready;});}
function label(){container.setAttribute('aria-label',`${names[state.gender]} — tenue ${names[state.outfit]}, ${names[state.item]}${state.pack?', sac à dos':''} — ${rotating?'rotation en cours':viewNames[angle]}`);}
function sync(){document.querySelectorAll('[data-slot]').forEach(button=>button.setAttribute('aria-pressed',String(state[button.dataset.slot]===button.dataset.value)));document.querySelector('#pack-toggle').checked=state.pack;document.querySelector('#dye-field').hidden=state.outfit!=='base';document.querySelector('#dye-name').textContent=names[state.dye];document.querySelector('#character-name').textContent=names[state.gender];document.querySelector('#look-description').textContent=`${names[state.outfit]} · ${names[state.item]}${state.pack?' · sac à dos':''}`;poster.src=`/assets/wardrobe/${state.gender==='male'?'noa':'mila'}-portrait.webp`;poster.alt=`${names[state.gender]}, aperçu de la tenue essentielle`;label();if(viewer){const count=viewer.applyState(state);document.querySelector('#visible-pieces').textContent=`${count.pieces} pièces affichées`;}}
async function load() {
  if (viewer || pending) return;
  setReady(false);
  retry.hidden = true;
  loading.hidden = false;
  loading.classList.remove('error');
  loading.textContent = 'Préparation du personnage 3D…';
  document.querySelector('.render-label').textContent = 'Chargement 3D';
  pending = (async () => {
    const { createWardrobeViewer } = await import('./wardrobe-viewer.mjs');
    viewer = await createWardrobeViewer(container, state, {
      onProgress: value => { loading.textContent = `Chargement du vestiaire… ${value} %`; },
      onError: text => {
        setReady(false);
        loading.textContent = text;
        loading.hidden = false;
        loading.classList.add('error');
        poster.hidden = false;
        container.setAttribute('aria-label', `${names[state.gender]}, aperçu de la tenue essentielle — 3D indisponible`);
        const canvas = container.querySelector('canvas');
        if (canvas) canvas.hidden = true;
        document.querySelector('.render-label').textContent = 'Aperçu Blender';
        document.querySelector('#visible-pieces').textContent = '3D indisponible';
      },
      onFreeView: () => {
        angle = 'free';
        rotating = false;
        document.querySelectorAll('[data-angle]').forEach(button => button.setAttribute('aria-pressed', 'false'));
        document.querySelector('#rotate-look').setAttribute('aria-pressed', 'false');
        label();
      }
    });
    poster.hidden = true;
    loading.hidden = true;
    setReady(true);
    document.querySelector('.render-label').textContent = '3D en temps réel';
    sync();
    viewer.setVisible(stageInView && !document.hidden);
  })().catch(error => {
    console.error('Wardrobe loading:', error);
    loading.textContent = 'Le vestiaire 3D n’a pas pu être chargé. L’aperçu reste disponible.';
    loading.classList.add('error');
    retry.hidden = false;
    document.querySelector('.render-label').textContent = 'Aperçu Blender';
    document.querySelector('#visible-pieces').textContent = '3D indisponible';
  }).finally(() => { pending = undefined; });
  return pending;
}
document.querySelectorAll('[data-slot]').forEach(button=>button.addEventListener('click',()=>{state[button.dataset.slot]=button.dataset.value;message.textContent='';sync();}));
document.querySelector('#pack-toggle').addEventListener('change',event=>{state.pack=event.target.checked;message.textContent='';sync();});
document.querySelectorAll('[data-angle]').forEach(button=>button.addEventListener('click',()=>{angle=button.dataset.angle;rotating=false;viewer?.setAngle(angle);document.querySelectorAll('[data-angle]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));document.querySelector('#rotate-look').setAttribute('aria-pressed','false');label();}));
document.querySelector('#rotate-look').addEventListener('click',event=>{rotating=!rotating;event.currentTarget.setAttribute('aria-pressed',String(rotating));if(rotating){angle='free';document.querySelectorAll('[data-angle]').forEach(b=>b.setAttribute('aria-pressed','false'));}viewer?.setRotation(rotating);label();});
document.querySelector('#reset-look').addEventListener('click',()=>{state={...defaults};angle='quarter';rotating=false;viewer?.setAngle('quarter');document.querySelectorAll('[data-angle]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.angle==='quarter')));document.querySelector('#rotate-look').setAttribute('aria-pressed','false');sync();message.textContent='La tenue de base de Noa a été rétablie.';});
document.querySelector('#export-look').addEventListener('click', async () => {
  const exportedState = { ...state };
  setReady(false);
  message.textContent = 'Préparation du fichier 3D…';
  try {
    const data = await viewer.exportLook();
    const url = URL.createObjectURL(new Blob([data], { type:'model/gltf-binary' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `class-odyssey-${names[exportedState.gender].toLowerCase()}-${exportedState.outfit}-${exportedState.item}${exportedState.pack ? '-backpack' : ''}.glb`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    message.textContent = 'Le téléchargement de cette combinaison est lancé.';
  } catch (error) {
    console.error('Wardrobe export:', error);
    message.textContent = 'L’export a échoué. Réessayez dans un instant.';
  } finally {
    setReady(true);
  }
});
retry.addEventListener('click',load);
document.addEventListener('visibilitychange',()=>viewer?.setVisible(stageInView && !document.hidden));
new IntersectionObserver(entries=>{stageInView=entries[0].isIntersecting;viewer?.setVisible(stageInView && !document.hidden);}).observe(document.querySelector('.character-stage'));
sync();load();
