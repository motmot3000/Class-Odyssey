import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialState,getCurrentClass } from '../src/domain.mjs';
import { renderTitle, titleTierOf, titleBackdropAttributes } from '../src/ui.mjs';
import { renderSheikahStudent,renderSheikahSheet,renderSheikahPersonalize,renderSheikahTeacher } from '../src/views/sheikah.mjs';
import { renderRules } from '../src/views/rules.mjs';
import { t,setLang } from '../src/i18n.mjs';

test('hero identity uses the equipped title, never the outfit or hair colour',()=>{
  const state=createInitialState(), classroom=getCurrentClass(state);
  const pupil={...classroom.pupils[0],name:'Alex <script>',title:'perfect-pupil',skin:'vocab-ranger',hairColor:'brown-hair'};
  const ui={query:'',angle:'quarter',openPanels:new Set(),scope:'selection',shopCategory:'outfit'};
  const picker=renderSheikahStudent({classroom:{...classroom,pupils:[pupil]},ui,pupil:null});
  assert.match(picker,/Pupil/);
  assert.doesNotMatch(picker,/>Ranger<|>Brown<|<script>/);
  assert.ok(picker.indexOf('picker-portrait')<picker.indexOf('rune-card-head'));
  const sheet=renderSheikahSheet(pupil,ui);
  assert.match(sheet,/data-title-labelled/);
  assert.doesNotMatch(sheet,/Ranger · Brown/);
  assert.match(renderSheikahPersonalize(pupil,ui),/data-title-labelled/);
  const board=renderSheikahTeacher({classroom:{...classroom,pupils:[pupil]},ui,targets:[],selectedIds:[]});
  assert.ok(board.indexOf('dais-card')<board.indexOf('rune-card-head'));
});

test('title decoration depends on the earned title, not the pupil level',()=>{
  assert.match(renderTitle({title:'perfect-pupil',level:20}),/data-title-tier="2"/);
  const legendary=renderTitle({title:'class-legend',level:10});
  assert.match(legendary,/data-title-tier="5"/);
  assert.ok(legendary.length>renderTitle({title:'perfect-pupil'}).length);
  assert.doesNotMatch(renderTitle({title:'"><script>'}),/<script>/);
});

test('titles climb a five-step prestige ladder with a matching backdrop',()=>{
  const tiers={rookie:1,'perfect-pupil':2,pathfinder:2,'scholar-virtuoso':3,'realm-champion':3,'grand-archon':4,'paragon-sovereign':4,'grammar-master':5,'class-legend':5};
  for(const [title,tier] of Object.entries(tiers)){
    assert.equal(titleTierOf({title}),tier,title);
    assert.match(renderTitle({title}),new RegExp(`data-title-tier="${tier}"`));
  }
  assert.equal(titleTierOf({title:'missing'}),1);
  assert.match(titleBackdropAttributes({title:'class-legend'}),/data-title-tier="5" data-title-id="class-legend"/);
  assert.doesNotMatch(titleBackdropAttributes({title:'"><script>'}),/<script>/);
  // Higher tiers accumulate ornament; the crown and rays only appear at the top.
  const rookie=renderTitle({title:'rookie'});
  const master=renderTitle({title:'grammar-master'});
  assert.doesNotMatch(rookie,/orn-crown|orn-rays/);
  assert.match(master,/orn-crown/);
  assert.match(master,/orn-rays/);
});

test('hero cards and the hero sheet expose the title backdrop layer',()=>{
  const classroom=getCurrentClass(createInitialState());
  const pupil={...classroom.pupils[0],title:'grammar-master'};
  const picker=renderSheikahStudent({classroom:{...classroom,pupils:[pupil]},ui:{},pupil:null});
  assert.match(picker,/class="dais dais-card" data-title-tier="5" data-title-id="grammar-master"/);
  assert.match(picker,/class="title-halo"/);
  const sheet=renderSheikahSheet(pupil,{});
  assert.match(sheet,/data-viewer-host[^>]*data-title-tier="5"/);
  assert.match(sheet,/title-halo/);
});

test('Rules preserves the original text and reading order in both languages',()=>{
  const text=html=>html.replace(/<svg[\s\S]*?<\/svg>/g,'').replace(/<\/(li|h1|h2|p)>/g,' ').replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim();
  const keys=['rules.title.how','rules.lede',...Array.from({length:7},(_,i)=>`rules.game.${i}`),'rules.title.xp','rules.xp.0','rules.xp.1','rules.title.money','rules.money.0','rules.money.1','rules.money.2','rules.back'];
  try{
    for(const lang of ['fr','en']){setLang(lang);assert.equal(text(renderRules()),text(keys.map(key=>t(key)).join(' ')));}
  }finally{setLang('en');}
});
