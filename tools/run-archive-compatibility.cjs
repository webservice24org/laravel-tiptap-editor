'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {expectedFiles,verifyArchive,hash,MAX_ARCHIVE}=require('./archive-contract.cjs');
const {validateRuntime}=require('./check-node-runtime.cjs');
const root=fs.realpathSync(path.join(__dirname,'..'));
const writeJson=(p,x)=>fs.writeFileSync(p,JSON.stringify(x,null,2)+'\n',{flag:'wx'});
const readJson=p=>JSON.parse(fs.readFileSync(p,'utf8'));
function outside(p){const rel=path.relative(root,p);assert.ok(rel==='..'||rel.startsWith('..'+path.sep)||path.isAbsolute(rel),'Archive output must be outside editor project');}
function readBounded(p){const s=fs.lstatSync(p);assert.ok(s.isFile()&&!s.isSymbolicLink()&&s.size>0&&s.size<=MAX_ARCHIVE,'Invalid archive file');return fs.readFileSync(p);}
function main(){
    const [mode,arg,...rest]=process.argv.slice(2);
    assert.ok(!rest.length&&((mode==='pack'&&(!arg||arg==='--built'))||(mode==='verify'&&arg)),'Usage: pack [--built] | verify <report-directory>');
    const npm=fs.realpathSync(process.env.npm_execpath||'');assert.equal(path.basename(npm),'npm-cli.js','Run through npm');
    const runtime=validateRuntime(process.versions.node,/^npm\/([^\s]+)/.exec(process.env.npm_config_user_agent||'')?.[1]);
    const baseline=()=>Object.fromEntries(['package.json','package-lock.json'].map(n=>[n,hash(fs.readFileSync(path.join(root,n)))]));
    const before=baseline();
    const run=(args,quiet=false)=>{
        const r=spawnSync(process.execPath,[npm,...args],{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024,timeout:10*60*1000,windowsHide:true});
        if(!quiet)process.stdout.write(r.stdout||'');process.stderr.write(r.stderr||'');
        if(r.error||r.status!==0){if(quiet)process.stderr.write(r.stdout||'');throw Error('npm '+args[0]+' failed: '+(r.error?.message||r.status));}
        return r.stdout;
    };
    if(mode==='pack'&&arg!=='--built')run(['run','build']);
    run(['run','check:types']);run(['run','check:bundle']);
    assert.deepEqual(baseline(),before,'Manifest or lock changed');
    const expected=expectedFiles(root);
    if(mode==='verify'){
        const report=fs.realpathSync(arg);outside(report);
        const pack=readJson(path.join(report,'pack.json'));
        const filename='webservice24org-laravel-tiptap-editor-'+JSON.parse(expected.get('package.json')).version+'.tgz';
        assert.match(filename,/^webservice24org-laravel-tiptap-editor-\d+\.\d+\.\d+\.tgz$/);
        const bytes=readBounded(path.join(report,filename));
        const actual=verifyArchive(bytes,expected,pack);
        assert.deepEqual(verifyArchive(bytes,expected,readJson(path.join(report,'repeat-pack.json'))),actual,'Repeat pack metadata mismatch');
        const saved=readJson(path.join(report,'archive-summary.json'));
        assert.equal(saved.status,'passed');assert.deepEqual(saved.archive,actual,'Saved archive summary mismatch');assert.deepEqual(saved.editor,before,'Saved manifest/lock hash mismatch');assert.equal(saved.repeat_pack_identical,true,'Missing repeat pack evidence');
        console.log(`Archive verified: ${actual.entries} entries, ${actual.dist_files} dist files, SHA-256 ${actual.sha256}`);return;
    }
    let report;
    if(process.env.ARCHIVE_REPORT_DIR){const target=path.resolve(process.env.ARCHIVE_REPORT_DIR);outside(target);const parent=fs.realpathSync(path.dirname(target));outside(parent);report=path.join(parent,path.basename(target));fs.mkdirSync(report);}
    else {const temp=fs.realpathSync(os.tmpdir());outside(temp);report=fs.mkdtempSync(path.join(temp,'MicroWeb-Tiptap-Archive-'));}
    const repeat=path.join(report,'repeat');fs.mkdirSync(repeat);
    console.log('Archive evidence directory: '+report);
    try{
        function packOnce(dest){const p=JSON.parse(run(['pack','--ignore-scripts','--dry-run=false','--json','--pack-destination',dest],true));const filename='webservice24org-laravel-tiptap-editor-'+JSON.parse(expected.get('package.json')).version+'.tgz';assert.match(filename,/^webservice24org-laravel-tiptap-editor-\d+\.\d+\.\d+\.tgz$/);const bytes=readBounded(path.join(dest,filename));return {p,bytes,result:verifyArchive(bytes,expected,p)};}
        const first=packOnce(report);writeJson(path.join(report,'pack.json'),first.p);
        const second=packOnce(repeat);writeJson(path.join(report,'repeat-pack.json'),second.p);
        assert.ok(first.bytes.equals(second.bytes),'Repeat npm pack bytes differ in same environment');
        assert.deepEqual(first.result,second.result,'Repeat archive evidence differs');
        assert.deepEqual(expectedFiles(root),expected,'Source distribution changed during packing');assert.deepEqual(baseline(),before,'Manifest or lock changed during packing');
        fs.rmSync(repeat,{recursive:true,force:true});
        writeJson(path.join(report,'archive-summary.json'),{status:'passed',...runtime,platform:process.platform,commit:process.env.GITHUB_SHA||null,editor:before,build_mode:arg==='--built'?'existing-verified-build':'fresh-build',repeat_pack_identical:true,archive:first.result});
        console.log(`Archive verified: ${first.result.entries} entries, ${first.result.dist_files} dist files, SHA-256 ${first.result.sha256}`);
        console.log('Repeat pack identical. Verified candidate: '+path.join(report,first.result.filename));
    }catch(e){console.error('Archive diagnostics retained: '+report);throw e;}
}
try{main();}catch(e){console.error('STOP: '+e.message);process.exitCode=1;}
