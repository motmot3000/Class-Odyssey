import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialState,getCurrentClass } from '../src/domain.mjs';
import { renderTitle } from '../src/ui.mjs';
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
  assert.match(renderTitle({title:'perfect-pupil',level:20}),/data-title-tier="1"/);
  const legendary=renderTitle({title:'class-legend',level:10});
  assert.match(legendary,/data-title-tier="4"/);
  assert.ok(legendary.length>renderTitle({title:'perfect-pupil'}).length);
  assert.doesNotMatch(renderTitle({title:'"><script>'}),/<script>/);
});

test('Rules preserves the original text and reading order in both languages',()=>{
  const text=html=>html.replace(/<svg[\s\S]*?<\/svg>/g,'').replace(/<\/(li|h1|h2|p)>/g,' ').replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim();
  const keys=['rules.title.how','rules.lede',...Array.from({length:7},(_,i)=>`rules.game.${i}`),'rules.title.xp','rules.xp.0','rules.xp.1','rules.title.money','rules.money.0','rules.money.1','rules.money.2','rules.back'];
  try{
    for(const lang of ['fr','en']){setLang(lang);assert.equal(text(renderRules()),text(keys.map(key=>t(key)).join(' ')));}
  }finally{setLang('en');}
});
