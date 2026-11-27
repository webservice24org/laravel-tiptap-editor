'use strict';
// Read-only GitHub metadata and downloaded reports; not cryptographic attestation.
const fs=require('node:fs'), path=require('node:path'), os=require('node:os'), assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {verifyPair,load}=require('./formatting-closure.cjs');
const {sha}=require('./consumer-contract.cjs');
const PHP_JOBS=["Discover compatibility matrix", "Required compatibility gate", "Required / laravel-12-php-82-latest", "Required / laravel-12-php-83-latest", "Required / laravel-12-php-84-latest", "Required / laravel-12-php-85-latest", "Required / laravel-13-php-83-latest", "Required / laravel-13-php-84-latest", "Required / laravel-13-php-85-latest", "Lower-bound probe / laravel-12-php-82-lowest", "Lower-bound probe / laravel-13-php-83-lowest"];
const NODE_JOBS=['ubuntu-24.04','windows-2025'].flatMap(os=>['22','24','26'].map(n=>`Build / ${os} / Node ${n}`)).concat('Required Node build compatibility gate');
const REACT_JOBS=['Consumer / React 18','Consumer / React 19','Required React consumer compatibility gate'];
const positive=v=>/^[1-9]\d*$/.test(String(v));
const workflowPath=v=>/^\.github\/workflows\/[A-Za-z0-9_.-]+\.ya?ml$/.test(v);
function verifyRun(run,jobs,expected){
    const {repo,commit,id,file,kind}=expected;
    assert.ok(workflowPath(file),'Invalid workflow path');
    assert.equal(String(run.id),id,'Run ID mismatch');assert.ok(positive(run.run_attempt),'Invalid attempt');
    assert.equal(run.repository?.full_name?.toLowerCase(),repo.toLowerCase(),'Repository mismatch');
    assert.equal(run.head_sha,commit,'Run commit mismatch');assert.equal(run.path,file,'Workflow path mismatch');
    assert.equal(run.status,'completed','Run not completed');assert.equal(run.conclusion,'success','Run did not succeed');
    assert.ok(['push','workflow_dispatch'].includes(run.event),'Expected push or manual branch workflow');
    assert.ok(['main','master'].includes(run.head_branch),'Expected main/master branch');
    assert.ok(Array.isArray(jobs.jobs));assert.equal(jobs.total_count,jobs.jobs.length,'Incomplete job list');
    const names=jobs.jobs.map(j=>j.name);assert.equal(new Set(names).size,names.length,'Duplicate job names');
    for(const j of jobs.jobs){assert.equal(String(j.run_id),id,'Job run mismatch');assert.equal(j.head_sha,commit,'Job commit mismatch');assert.equal(j.status,'completed','Job not completed: '+j.name);assert.equal(j.conclusion,'success','Job not successful: '+j.name);}
    if(kind==='node'||kind==='react')assert.deepEqual([...names].sort(),[...(kind==='node'?NODE_JOBS:REACT_JOBS)].sort(),'Required job inventory mismatch: '+kind);
    else {assert.equal(kind,'php');assert.deepEqual([...names].sort(),[...PHP_JOBS].sort(),'Required PHP job inventory mismatch (including discovery and gate)');}
    return {kind,id,attempt:String(run.run_attempt),file,commit,jobNames:names.sort(),url:run.html_url};
}
function verifyHostedPair(computed,hosted,reactRun){
    assert.equal(computed.status,'react-evidence-consistent');assert.equal(computed.commit,reactRun.commit);
    assert.equal(computed.runId,reactRun.id);assert.equal(computed.runAttempt,reactRun.attempt);
    assert.equal(computed.browserChecks,238);assert.equal(computed.distributionFiles,39);
    assert.deepEqual(hosted,computed,'Hosted pair differs from independently verified reports');
}
function validateInputs(repo,ids,phpPath){
    assert.match(repo,/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/,'Expected OWNER/REPO');
    assert.ok(ids.every(positive)&&new Set(ids).size===3,'Require three distinct positive workflow run IDs');
    assert.ok(workflowPath(phpPath)&&!['.github/workflows/editor-node-build.yml','.github/workflows/editor-react-consumer.yml'].includes(phpPath),'Specify the real PHP workflow path');
}
function main(){
    const [repo,phpId,nodeId,reactId,phpPath,out,...rest]=process.argv.slice(2);
    assert.ok(repo&&phpId&&nodeId&&reactId&&phpPath&&out&&!rest.length,'Usage: node tools/frontend-closure.cjs OWNER/REPO PHP_RUN_ID NODE_RUN_ID REACT_RUN_ID PHP_WORKFLOW_PATH OUTPUT_JSON');
    validateInputs(repo,[phpId,nodeId,reactId],phpPath);
    const root=path.resolve(__dirname,'..');const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
    const commit=git('rev-parse','HEAD');assert.match(commit,/^[a-f0-9]{40}$/);
    assert.equal(git('status','--porcelain','--untracked-files=normal'),'','Commit or remove local changes before closure');
    const dest=path.resolve(out);assert.ok(!fs.existsSync(dest),'Output already exists; use a fresh report path');
    const relative=path.relative(root,dest);assert.ok(relative.startsWith('..'+path.sep)||relative==='..'||path.isAbsolute(relative),'Store report outside project');
    const gh=(...args)=>execFileSync('gh',args,{cwd:root,encoding:'utf8',maxBuffer:32*1024*1024,stdio:['ignore','pipe','inherit']});
    const api=url=>JSON.parse(gh('api',url));
    const runInfo=(kind,id,file)=>{const base=`repos/${repo}/actions/runs/${id}`,run=api(base);assert.ok(positive(run.run_attempt));return verifyRun(run,api(`${base}/attempts/${run.run_attempt}/jobs?per_page=100`),{repo,commit,id,file,kind});};
    const runs=[runInfo('php',phpId,phpPath),runInfo('node',nodeId,'.github/workflows/editor-node-build.yml'),runInfo('react',reactId,'.github/workflows/editor-react-consumer.yml')];
    const rr=runs[2],temp=fs.mkdtempSync(path.join(os.tmpdir(),'tiptap-f9-'));
    try{
        const download=(name,dir)=>{const dest=path.join(temp,dir);fs.mkdirSync(dest);gh('run','download',reactId,'--repo',repo,'--name',name,'--dir',dest);return dest;};
        const a=download(`react-18-consumer-attempt-${rr.attempt}`,'react18'),b=download(`react-19-consumer-attempt-${rr.attempt}`,'react19'),p=download(`react-pair-attempt-${rr.attempt}`,'pair');
        const norm=name=>Buffer.from(fs.readFileSync(path.join(root,name),'utf8').replace(/\r\n/g,'\n'));
        const manifest=norm('package.json'),lock=norm('package-lock.json');
        const baseline={manifest:JSON.parse(manifest),lock:JSON.parse(lock),hashes:{'package.json':sha(manifest),'package-lock.json':sha(lock)}};
        const pair=verifyPair(load(a),load(b),commit,baseline,{runId:rr.id,runAttempt:rr.attempt});
        verifyHostedPair(pair,JSON.parse(fs.readFileSync(path.join(p,'react-pair.json'),'utf8')),rr);
        assert.deepEqual(runs,[runInfo('php',phpId,phpPath),runInfo('node',nodeId,'.github/workflows/editor-node-build.yml'),runInfo('react',reactId,'.github/workflows/editor-react-consumer.yml')],'Workflow changed during verification; rerun closure');
        assert.equal(git('rev-parse','HEAD'),commit);assert.equal(git('status','--porcelain','--untracked-files=normal'),'');
        const report={schema:1,status:'frontend-ci-evidence-verified',commit,repository:repo,version:baseline.manifest.version,verifiedAt:new Date().toISOString(),runs,react:pair,limitations:['Exact PHP inventory checked: seven latest, two lowest, discovery and gate.','Node and PHP job conclusions checked; their artifact contents are not independently replayed.','React report consistency, not execution attestation.','Manual QA and local regression acceptance remain separate.','No publication or MWT integration performed.']};
        fs.writeFileSync(dest,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(report,null,2));
    }finally{fs.rmSync(temp,{recursive:true,force:true});}
}
module.exports={verifyRun,verifyHostedPair,validateInputs,PHP_JOBS,NODE_JOBS,REACT_JOBS};
if(require.main===module){try{main();}catch(e){console.error('STOP: '+e.message);process.exitCode=1;}}
