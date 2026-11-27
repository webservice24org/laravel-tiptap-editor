'use strict';
// Offline evidence consistency review, not a new execution or an attestation.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { NAME, plan, packInventory, sha } = require('./consumer-contract.cjs');
const { verifyBrowserEvidence, TOTAL } = require('./browser-evidence.cjs');
const { cleanAudit } = require('./node-build-evidence.cjs');
const { validateRuntime } = require('./check-node-runtime.cjs');
const COMMANDS = Object.freeze(['library-types','library-bundle','pack','resolve','install','installed-tree','audit-all','audit-runtime','consumer-typecheck','consumer-build','chromium-dependencies','chromium-install','browser']);
const DIST_NAMES = Object.freeze(["components/CodeEditor.d.ts", "components/TiptapEditor.d.ts", "components/dialogs/Dialog.d.ts", "components/dialogs/ImageDialog.d.ts", "components/dialogs/LinkDialog.d.ts", "components/dialogs/NewsBlockDialog.d.ts", "components/dialogs/TableDialog.d.ts", "components/dialogs/TablePropertiesDialog.d.ts", "components/dialogs/VideoDialog.d.ts", "components/icons/EditorIcons.d.ts", "components/icons/TableToolbarIcons.d.ts", "components/icons/TopToolbarIcons.d.ts", "components/nodeviews/ImageFigureView.d.ts", "components/nodeviews/NewsBlockView.d.ts", "components/nodeviews/VideoEmbedView.d.ts", "components/toolbar/EditorButton.d.ts", "components/toolbar/EditorToolbar.d.ts", "components/toolbar/FormatDropdown.d.ts", "components/toolbar/TableContextualToolbar.d.ts", "components/toolbar/ToolbarGroup.d.ts", "editor.css", "extensions/ImageFigure.d.ts", "extensions/NewsBlock.d.ts", "extensions/Table.d.ts", "extensions/TableCell.d.ts", "extensions/TableHeader.d.ts", "extensions/VideoEmbed.d.ts", "extensions/editorExtensions.d.ts", "hooks/useImageUpload.d.ts", "index.d.ts", "index.js", "index.js.map", "third-party/dompurify-LICENSE-MPL.txt", "third-party/dompurify-LICENSE.txt", "types/editor.d.ts", "types/media.d.ts", "types/newsBlock.d.ts", "utils/sanitizeHtml.d.ts", "utils/video.d.ts"]);
const HEX = /^[a-f0-9]{64}$/;
const SRI = /^sha512-[A-Za-z0-9+/]{86}==$/;
const normalize = b => Buffer.from(b.toString('utf8').replace(/\r\n/g,'\n'));
function readEvidence(dir, name) {
    const file = path.join(dir, name), stat = fs.lstatSync(file);
    assert.ok(stat.isFile() && !stat.isSymbolicLink() && stat.size > 0 && stat.size <= 16*1024*1024, 'Invalid evidence file: '+name);
    return fs.readFileSync(file);
}
function load(dir) {
    const st=fs.lstatSync(dir);assert.ok(st.isDirectory()&&!st.isSymbolicLink(),'Expected extracted artifact directory');
    const json = name => JSON.parse(readEvidence(dir,name));
    for(const name of ['browser-failure.json','browser-failure.png'])assert.ok(!fs.existsSync(path.join(dir,name)),'Failure evidence present: '+name);
    return {summary:json('consumer-summary.json'),browser:json('browser-summary.json'),run:json('run-status.json'),lockBytes:readEvidence(dir,'consumer-lock.json'),manifest:json('consumer-manifest.json'),pack:json('pack.json'),audits:[json('audit-all.json'),json('audit-runtime.json')],tree:json('installed-tree.json')};
}
function verifyLane(e, lane, commit, baseline, provenance) {
    assert.ok(['18','19'].includes(lane));assert.match(commit,/^[a-f0-9]{40}$/,'Full hosted commit SHA required');
    const s=e.summary,r=e.run,p=plan(lane,baseline.manifest,baseline.lock);
    assert.equal(s.status,'passed');assert.equal(s.lane,lane);assert.equal(s.commit,commit,'Consumer commit mismatch');
    assert.equal(s.platform,'linux','Expected hosted Linux consumer evidence');
    assert.equal(s.major,24);validateRuntime(s.node,s.npm,'24');
    assert.deepEqual(s.editor,baseline.hashes,'Editor manifest/lock mismatch');
    if(provenance){
        for(const [key,value] of Object.entries(provenance)){
            assert.match(value,/^[1-9]\d*$/,'Invalid expected '+key);
            assert.equal(s[key],value,'Consumer '+key+' mismatch');
            assert.equal(r[key],value,'Run status '+key+' mismatch');
        }
    }
    assert.equal(r.schema,1);assert.equal(r.status,'passed');assert.equal(r.stage,'complete');assert.equal(r.lane,lane);assert.equal(r.commit,commit,'Run status commit mismatch');
    assert.deepEqual(r.completedCommands,COMMANDS,'Incomplete hosted command ledger');assert.equal(r.browserChecks,TOTAL);
    assert.ok(Number.isFinite(r.elapsedMs)&&r.elapsedMs>=0,'Invalid run duration');
    assert.deepEqual(s.browser,e.browser,'Browser summaries disagree');
    assert.equal(verifyBrowserEvidence(e.browser,p.expected.react),TOTAL);
    assert.equal(s.audits,'clean');assert.equal(e.audits.length,2);for(const audit of e.audits)cleanAudit(audit);
    assert.ok(!e.tree.problems?.length,'Installed tree reported problems');
    assert.deepEqual(e.manifest,p.manifest,'Consumer manifest mismatch');
    assert.equal(s.consumer_lock_sha256,sha(e.lockBytes),'Consumer lock checksum mismatch');
    const lock=JSON.parse(e.lockBytes);assert.equal(lock.lockfileVersion,3);
    for(const [n,v] of Object.entries(p.expected)){assert.equal(s.singleton[n],v,'Recorded singleton mismatch: '+n);assert.equal(lock.packages['node_modules/'+n]?.version,v,'Locked version mismatch: '+n);}
    assert.match(s.archive_sha256,HEX,'Invalid archive SHA-256');
    const dist=Object.keys(s.dist_hashes).sort();assert.deepEqual(dist,DIST_NAMES,'Distribution inventory mismatch');
    assert.equal(new Set(dist.map(n=>n.toLowerCase())).size,39,'Case-colliding distribution paths');
    for(const n of dist){assert.ok(n.split('/').every(part=>/^[A-Za-z0-9_@.-]+$/.test(part)&&part!=='.'&&part!=='..'),'Unsafe distribution path');assert.match(s.dist_hashes[n],HEX,'Invalid distribution hash');}
    for(const n of ['index.js','index.js.map','index.d.ts','editor.css','third-party/dompurify-LICENSE.txt','third-party/dompurify-LICENSE-MPL.txt'])assert.ok(dist.includes(n),'Missing distribution file: '+n);
    assert.equal(dist.filter(n=>n.endsWith('.d.ts')).length,34,'Declaration count');
    packInventory(e.pack,dist);const pkg=e.pack[0];assert.equal(pkg.version,baseline.manifest.version);assert.equal(pkg.entryCount,42);assert.match(pkg.integrity,SRI,'Invalid archive integrity metadata');
    assert.equal(lock.packages['node_modules/'+NAME].resolved,'file:editor.tgz');assert.equal(lock.packages['node_modules/'+NAME].integrity,pkg.integrity,'Archive integrity metadata mismatch');
    return {lane,commit,react:p.expected.react,checks:TOTAL,archive_sha256:s.archive_sha256,integrity:pkg.integrity,dist_hashes:s.dist_hashes,warnings:e.browser.warnings};
}
function verifyPair(a,b,commit,baseline,provenance){
    if(provenance)assert.deepEqual(Object.keys(provenance).sort(),['runAttempt','runId'],'Incomplete provenance');
    const lanes=[verifyLane(a,'18',commit,baseline,provenance),verifyLane(b,'19',commit,baseline,provenance)];
    for(const field of ['archive_sha256','integrity','dist_hashes'])assert.deepEqual(lanes[0][field],lanes[1][field],'Cross-consumer mismatch: '+field);
    return {status:'react-evidence-consistent',commit,...(provenance||{}),browserChecks:TOTAL*2,lanes:lanes.map(({lane,react,checks,warnings})=>({lane,react,checks,warnings})),archive_sha256:lanes[0].archive_sha256,distributionFiles:39,limitations:'Offline report consistency only; archive bytes not supplied. Verify PHP, Node and React workflow success separately on the same commit.'};
}
function main(){
    const [commit,react18,react19,...rest]=process.argv.slice(2);assert.ok(commit&&react18&&react19&&[0,2].includes(rest.length),'Usage: node tools/formatting-closure.cjs <full-commit-sha> <React18-extracted-dir> <React19-extracted-dir> [run-id run-attempt]');
    const provenance=rest.length?{runId:rest[0],runAttempt:rest[1]}:undefined;
    assert.notEqual(fs.realpathSync(react18),fs.realpathSync(react19),'Provide two independent artifacts');
    const root=path.resolve(__dirname,'..');const manifest=normalize(fs.readFileSync(path.join(root,'package.json'))),lock=normalize(fs.readFileSync(path.join(root,'package-lock.json')));
    const baseline={manifest:JSON.parse(manifest),lock:JSON.parse(lock),hashes:{'package.json':sha(manifest),'package-lock.json':sha(lock)}};
    console.log(JSON.stringify(verifyPair(load(react18),load(react19),commit,baseline,provenance),null,2));
}
module.exports={COMMANDS,DIST_NAMES,verifyLane,verifyPair,load};
if(require.main===module){try{main();}catch(e){console.error('STOP: '+e.message);process.exitCode=1;}}
