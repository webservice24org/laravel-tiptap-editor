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
function browserFixture(){const report={schema:1,status:'passed',react:'18.3.1',chromium:'159.0.8154.6',checks:[...EXPECTED.smoke],errors:[],unexpected:[],warnings:[],totalChecks:119,timingsMs:{}};for(const [name,checks] of Object.entries(EXPECTED)){report.timingsMs[name]=0;if(name!=='smoke')report[name]={status:'passed',checks:[...checks]};}return report;}
test('browser evidence inventory retains 119 ordered groups',()=>{assert.equal(TOTAL,119);assert.deepEqual(Object.values(EXPECTED).map(x=>x.length),[9,22,10,14,13,12,5,10,10,8,6]);assert.equal(verifyBrowserEvidence(browserFixture(),'18.3.1'),119);});
test('reject missing smoke group',()=>{const r=browserFixture();r.checks.pop();assert.throws(()=>verifyBrowserEvidence(r,r.react),/smoke/);});
test('reject skipped or absent suite',()=>{const r=browserFixture();r.history.status='skipped';assert.throws(()=>verifyBrowserEvidence(r,r.react),/history/);delete r.history;assert.throws(()=>verifyBrowserEvidence(r,r.react),/history/);});
test('reject duplicate, extra or reordered checks',()=>{for(const mutate of [a=>a.push(a[0]),a=>a.push('unknown'),a=>a.reverse()]){const r=browserFixture();mutate(r.blocks.checks);assert.throws(()=>verifyBrowserEvidence(r,r.react),/blocks/);}});
test('reject failed or unversioned evidence',()=>{for(const [key,value] of [['status','failed'],['schema',undefined]]){const r=browserFixture();r[key]=value;assert.throws(()=>verifyBrowserEvidence(r,r.react));}});
test('reject wrong React and missing Chromium',()=>{const r=browserFixture();assert.throws(()=>verifyBrowserEvidence(r,'19.3.1'),/React/);r.chromium='';assert.throws(()=>verifyBrowserEvidence(r,r.react),/Chromium/);});
test('reject console errors or remote requests',()=>{for(const key of ['errors','unexpected']){const r=browserFixture();r[key]=['failure'];assert.throws(()=>verifyBrowserEvidence(r,r.react));}});
test('allow recorded nonblocking warnings only',()=>{const r=browserFixture();r.warnings=['synthetic warning'];assert.equal(verifyBrowserEvidence(r,r.react),119);r.warnings=[null];assert.throws(()=>verifyBrowserEvidence(r,r.react),/warning/);});
test('reject wrong count or incomplete or invalid timings',()=>{for(const mutate of [r=>r.totalChecks=94,r=>delete r.timingsMs.smoke,r=>r.timingsMs.history=-1,r=>r.timingsMs.history=Infinity]){const r=browserFixture();mutate(r);assert.throws(()=>verifyBrowserEvidence(r,r.react));}});
test('reject unrecognized browser suite',()=>assert.throws(()=>verifySuite('extra',{status:'passed',checks:[]}),/Unknown/));
test('classify browser provisioning separately from execution and evidence',()=>{assert.equal(stageCategory('chromium-dependencies'),'browser-provisioning');assert.equal(stageCategory('chromium-install'),'browser-provisioning');assert.equal(stageCategory('browser'),'browser-execution');assert.equal(stageCategory('browser-evidence'),'evidence-validation');assert.equal(stageCategory('consumer-build'),'consumer-preflight-or-build');});

// F3I offline closure contract: synthetic records, never real CI acceptance evidence.
const {COMMANDS,DIST_NAMES:closureDistNames,verifyPair,load:loadClosure}=require('./formatting-closure.cjs');
const closureCommit='a'.repeat(40);
const closureHash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const closureBaseline={manifest,lock,hashes:{'package.json':'1'.repeat(64),'package-lock.json':'2'.repeat(64)}};
function closureFixture(lane){
    const {p,l}=fixture(lane), browser=browserFixture();browser.react=p.expected.react;
    const lockBytes=Buffer.from(JSON.stringify(l));
    const names=closureDistNames;
    const dist_hashes=Object.fromEntries(names.map(n=>[n,closureHash(n)]));
    const audit={auditReportVersion:2,vulnerabilities:{},metadata:{vulnerabilities:{info:0,low:0,moderate:0,high:0,critical:0,total:0}}};
    return {summary:{status:'passed',lane,commit:closureCommit,platform:'linux',major:24,node:'24.22.3',npm:'11.19.1',editor:structuredClone(closureBaseline.hashes),browser:structuredClone(browser),audits:'clean',consumer_lock_sha256:closureHash(lockBytes),singleton:p.expected,archive_sha256:closureHash(archive),dist_hashes},browser,run:{schema:1,status:'passed',stage:'complete',lane,commit:closureCommit,completedCommands:[...COMMANDS],browserChecks:119,elapsedMs:100},lockBytes,manifest:p.manifest,pack:[{name:NAME,version:manifest.version,filename:'microweb-laravel-tiptap-editor-'+manifest.version+'.tgz',integrity:digest,entryCount:42,files:['LICENSE','README.md','package.json',...names.map(n=>'dist/'+n)].map(path=>({path}))}],audits:[structuredClone(audit),structuredClone(audit)],tree:{}};
}
const closePair=(mutate=()=>{})=>{const a=closureFixture('18'),b=closureFixture('19');mutate(a,b);return verifyPair(a,b,closureCommit,closureBaseline);};
test('closure accepts two same-commit complete consumer reports',()=>{const result=closePair();assert.equal(result.status,'react-evidence-consistent');assert.equal(result.browserChecks,238);assert.equal(result.distributionFiles,39);});
test('closure rejects stale or mixed commits',()=>{assert.throws(()=>closePair((a,b)=>b.summary.commit='b'.repeat(40)),/Consumer commit/);assert.throws(()=>closePair(a=>a.run.commit='b'.repeat(40)),/Run status commit/);});
test('closure rejects swapped React lanes',()=>assert.throws(()=>closePair(a=>a.summary.lane='19')));
test('closure rejects unsuccessful or incomplete command ledger',()=>{assert.throws(()=>closePair(a=>a.run.status='failed'));assert.throws(()=>closePair(a=>a.run.completedCommands.pop()),/ledger/);});
test('closure rejects inconsistent browser summaries and missing checks',()=>{assert.throws(()=>closePair(a=>a.browser.totalChecks=104),/summaries/);assert.throws(()=>closePair(a=>{a.browser.history.checks.pop();a.summary.browser=structuredClone(a.browser);}),/history/);});
test('closure rejects baseline drift',()=>assert.throws(()=>closePair(a=>a.summary.editor['package.json']='0'.repeat(64)),/manifest\/lock/));
test('closure rejects changed lock bytes and dependency version drift',()=>{assert.throws(()=>closePair(a=>a.lockBytes=Buffer.from('{}')),/checksum/);assert.throws(()=>closePair(a=>a.summary.singleton.react='0.0.0'),/singleton/);});
test('closure rejects audit vulnerability evidence',()=>assert.throws(()=>closePair(a=>a.audits[1].metadata.vulnerabilities.high=1),/Audit count/));
test('closure rejects archive metadata mismatch',()=>assert.throws(()=>closePair(a=>a.pack[0].integrity=integrity),/integrity metadata mismatch/));
test('closure rejects different archive checksums across consumers',()=>assert.throws(()=>closePair((a,b)=>b.summary.archive_sha256='3'.repeat(64)),/Cross-consumer mismatch/));
test('closure rejects different distribution bytes across consumers',()=>assert.throws(()=>closePair((a,b)=>b.summary.dist_hashes['index.js']='3'.repeat(64)),/Cross-consumer mismatch/));
test('closure rejects incorrect distribution inventory',()=>assert.throws(()=>closePair(a=>{delete a.summary.dist_hashes['index.d.ts'];a.summary.dist_hashes['fake.d.ts']='3'.repeat(64);}),/inventory/i));
test('closure loader rejects missing status and recorded failure',()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'closure-test-'));try{assert.throws(()=>loadClosure(dir));fs.writeFileSync(path.join(dir,'browser-failure.json'),'{}');assert.throws(()=>loadClosure(dir),/Failure evidence/);}finally{fs.rmSync(dir,{recursive:true,force:true});}});

test('reject missing media regression evidence',()=>{const r=browserFixture();delete r.media;assert.throws(()=>verifyBrowserEvidence(r,r.react),/media/);});
test('reject reordered media regression evidence',()=>{const r=browserFixture();r.media.checks.reverse();assert.throws(()=>verifyBrowserEvidence(r,r.react),/media/);});

test('reject missing rich block regression evidence',()=>{const r=browserFixture();delete r.richBlocks;assert.throws(()=>verifyBrowserEvidence(r,r.react),/richBlocks/);});
test('reject reordered rich block regression evidence',()=>{const r=browserFixture();r.richBlocks.checks.reverse();assert.throws(()=>verifyBrowserEvidence(r,r.react),/richBlocks/);});

test('reject missing source security evidence',()=>{const r=browserFixture();delete r.sourceSecurity;assert.throws(()=>verifyBrowserEvidence(r,r.react),/sourceSecurity/);});
test('reject reordered source security evidence',()=>{const r=browserFixture();r.sourceSecurity.checks.reverse();assert.throws(()=>verifyBrowserEvidence(r,r.react),/sourceSecurity/);});

test('reject missing responsive evidence',()=>{const r=browserFixture();delete r.responsive;assert.throws(()=>verifyBrowserEvidence(r,r.react),/responsive/);});
test('reject reordered responsive evidence',()=>{const r=browserFixture();r.responsive.checks.reverse();assert.throws(()=>verifyBrowserEvidence(r,r.react),/responsive/);});
