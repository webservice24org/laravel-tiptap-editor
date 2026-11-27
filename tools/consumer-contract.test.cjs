'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {NAME,plan,verifyLock,packInventory}=require('./consumer-contract.cjs');
const manifest=require('../package.json'),lock=require('../package-lock.json');
const archive=Buffer.from('synthetic archive');const digest='sha512-'+crypto.createHash('sha512').update(archive).digest('base64');
const integrity='sha512-'+Buffer.alloc(64).toString('base64');
function fixture(major='18'){const p=plan(major,manifest,lock);const l={lockfileVersion:3,packages:{'':{}}};for(const [n,version] of Object.entries(p.expected))l.packages['node_modules/'+n]={version,resolved:n===NAME?'file:editor.tgz':'https://registry.npmjs.org/'+n+'/-/x.tgz',integrity:n===NAME?digest:integrity};return {p,l};}
test('React 18 isolated manifest and type versions',()=>{const {p}=fixture();assert.equal(p.manifest.dependencies.react,'18.3.1');assert.equal(p.manifest.devDependencies['@types/react'],'18.3.12');assert.equal(p.manifest.dependencies[NAME],'file:./editor.tgz');assert.equal(p.manifest.private,true);});
test('React 19 accepted root versions',()=>{const {p}=fixture('19');assert.equal(p.expected.react,'19.3.1');assert.equal(p.expected['react-dom'],'19.3.1');assert.equal(p.expected['@types/react'],'19.3.0');});
test('all 32 Tiptap records aligned',()=>{const {p}=fixture();assert.equal(Object.keys(p.expected).filter(k=>k.startsWith('@tiptap/')).length,32);assert.equal(p.manifest.dependencies['@tiptap/pm'],'3.32.0');});
test('reject unknown lane',()=>assert.throws(()=>plan('20',manifest,lock),/lane/));
test('reject modified accepted Tiptap record',()=>{const l=structuredClone(lock);l.packages['node_modules/@tiptap/core'].version='3.35.0';assert.throws(()=>plan('18',manifest,l),/Tiptap versions/);});
test('accept clean isolated lock',()=>{const {p,l}=fixture();assert.equal(verifyLock(l,p.expected,archive).react,'18.3.1');});
test('reject mismatched React version',()=>{const {p,l}=fixture();l.packages['node_modules/react'].version='19.3.1';assert.throws(()=>verifyLock(l,p.expected,archive),/version: react/);});
test('reject nested React',()=>{const {p,l}=fixture();l.packages['node_modules/foo/node_modules/react']={...l.packages['node_modules/react']};assert.throws(()=>verifyLock(l,p.expected,archive),/Nested singleton/);});
test('reject nested ProseMirror',()=>{const {p,l}=fixture();l.packages['node_modules/foo/node_modules/prosemirror-model']={version:'1.25.12',resolved:'https://registry.npmjs.org/x',integrity};assert.throws(()=>verifyLock(l,p.expected,archive),/Nested singleton/);});
test('reject unrecognized Tiptap',()=>{const {p,l}=fixture();l.packages['node_modules/@tiptap/extra']={version:'3.32.0',resolved:'https://registry.npmjs.org/x',integrity};assert.throws(()=>verifyLock(l,p.expected,archive),/Unexpected Tiptap/);});
test('reject missing singleton',()=>{const {p,l}=fixture();delete l.packages['node_modules/@tiptap/pm'];assert.throws(()=>verifyLock(l,p.expected,archive),/missing version/);});
test('reject local link',()=>{const {p,l}=fixture();l.packages['node_modules/'+NAME].link=true;assert.throws(()=>verifyLock(l,p.expected,archive),/Linked dependency/);});
test('reject archive mismatch',()=>{const {p,l}=fixture();assert.throws(()=>verifyLock(l,p.expected,Buffer.from('bad')),/Archive integrity/);});
test('reject unexpected registry',()=>{const {p,l}=fixture();l.packages['node_modules/react'].resolved='https://example.com/react.tgz';assert.throws(()=>verifyLock(l,p.expected,archive),/Unexpected registry/);});
test('reject absent integrity',()=>{const {p,l}=fixture();delete l.packages['node_modules/react'].integrity;assert.throws(()=>verifyLock(l,p.expected,archive));});
const pack=[{name:NAME,filename:'microweb-laravel-tiptap-editor-1.0.0.tgz',files:['package.json','README.md','LICENSE','dist/index.js'].map(path=>({path}))}];
test('accept expected pack inventory',()=>assert.equal(packInventory(pack,['index.js']),pack[0].filename));
test('reject extra packed source',()=>{const p=structuredClone(pack);p[0].files.push({path:'resources/js/index.ts'});assert.throws(()=>packInventory(p,['index.js']),/inventory/);});
test('reject unsafe archive filename',()=>{const p=structuredClone(pack);p[0].filename='../editor.tgz';assert.throws(()=>packInventory(p,['index.js']));});
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {verifyInstalled}=require('./consumer-contract.cjs');
function installedFixture(fn){const temp=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'consumer-contract-')));try{const work=path.join(temp,'consumer'),source=path.join(temp,'source');const {p,l}=fixture();const dest=path.join(work,'node_modules',NAME);for(const [n,version] of Object.entries(p.expected)){const folder=path.join(work,'node_modules',n);fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(path.join(folder,'package.json'),JSON.stringify({name:n,version}));}for(const folder of [source,dest]){fs.mkdirSync(path.join(folder,'dist'),{recursive:true});fs.writeFileSync(path.join(folder,'package.json'),JSON.stringify(manifest));fs.writeFileSync(path.join(folder,'dist','index.js'),'export {};');}fn({work,source,p,l,dest});}finally{fs.rmSync(temp,{recursive:true,force:true});}}
test('accept matching installed dist bytes and real package paths',()=>installedFixture(({work,source,p,l})=>{assert.equal(verifyInstalled(work,source,p.expected,l,archive).dist_hashes['index.js'],crypto.createHash('sha256').update('export {};').digest('hex'));}));
test('reject installed archive byte drift',()=>installedFixture(({work,source,p,l,dest})=>{fs.writeFileSync(path.join(dest,'dist','index.js'),'unexpected');assert.throws(()=>verifyInstalled(work,source,p.expected,l,archive),/Installed dist mismatch/);}));

const {EXPECTED,TOTAL,verifySuite,verifyBrowserEvidence,stageCategory}=require('./browser-evidence.cjs');
function browserFixture(){const report={schema:1,status:'passed',react:'18.3.1',chromium:'159.0.8154.6',checks:[...EXPECTED.smoke],errors:[],unexpected:[],warnings:[],totalChecks:85,timingsMs:{}};for(const [name,checks] of Object.entries(EXPECTED)){report.timingsMs[name]=0;if(name!=='smoke')report[name]={status:'passed',checks:[...checks]};}return report;}
test('browser evidence inventory retains 85 ordered groups',()=>{assert.equal(TOTAL,85);assert.deepEqual(Object.values(EXPECTED).map(x=>x.length),[9,22,10,14,13,12,5]);assert.equal(verifyBrowserEvidence(browserFixture(),'18.3.1'),85);});
test('reject missing smoke group',()=>{const r=browserFixture();r.checks.pop();assert.throws(()=>verifyBrowserEvidence(r,r.react),/smoke/);});
test('reject skipped or absent suite',()=>{const r=browserFixture();r.history.status='skipped';assert.throws(()=>verifyBrowserEvidence(r,r.react),/history/);delete r.history;assert.throws(()=>verifyBrowserEvidence(r,r.react),/history/);});
test('reject duplicate, extra or reordered checks',()=>{for(const mutate of [a=>a.push(a[0]),a=>a.push('unknown'),a=>a.reverse()]){const r=browserFixture();mutate(r.blocks.checks);assert.throws(()=>verifyBrowserEvidence(r,r.react),/blocks/);}});
test('reject failed or unversioned evidence',()=>{for(const [key,value] of [['status','failed'],['schema',undefined]]){const r=browserFixture();r[key]=value;assert.throws(()=>verifyBrowserEvidence(r,r.react));}});
test('reject wrong React and missing Chromium',()=>{const r=browserFixture();assert.throws(()=>verifyBrowserEvidence(r,'19.3.1'),/React/);r.chromium='';assert.throws(()=>verifyBrowserEvidence(r,r.react),/Chromium/);});
test('reject console errors or remote requests',()=>{for(const key of ['errors','unexpected']){const r=browserFixture();r[key]=['failure'];assert.throws(()=>verifyBrowserEvidence(r,r.react));}});
test('allow recorded nonblocking warnings only',()=>{const r=browserFixture();r.warnings=['synthetic warning'];assert.equal(verifyBrowserEvidence(r,r.react),85);r.warnings=[null];assert.throws(()=>verifyBrowserEvidence(r,r.react),/warning/);});
test('reject wrong count or incomplete or invalid timings',()=>{for(const mutate of [r=>r.totalChecks=84,r=>delete r.timingsMs.smoke,r=>r.timingsMs.history=-1,r=>r.timingsMs.history=Infinity]){const r=browserFixture();mutate(r);assert.throws(()=>verifyBrowserEvidence(r,r.react));}});
test('reject unrecognized browser suite',()=>assert.throws(()=>verifySuite('extra',{status:'passed',checks:[]}),/Unknown/));
test('classify browser provisioning separately from execution and evidence',()=>{assert.equal(stageCategory('chromium-dependencies'),'browser-provisioning');assert.equal(stageCategory('chromium-install'),'browser-provisioning');assert.equal(stageCategory('browser'),'browser-execution');assert.equal(stageCategory('browser-evidence'),'evidence-validation');assert.equal(stageCategory('consumer-build'),'consumer-preflight-or-build');});
