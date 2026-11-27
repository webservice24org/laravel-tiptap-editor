'use strict';
const fs=require('node:fs'), path=require('node:path'), os=require('node:os'), assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {plan,verifyLock,packInventory,verifyInstalled,inventory,sha,readJson}=require('./consumer-contract.cjs');
const {validateRuntime}=require('./check-node-runtime.cjs');
const {cleanAudit}=require('./node-build-evidence.cjs');
const {verifyBrowserEvidence,stageCategory}=require('./browser-evidence.cjs');
const root=fs.realpathSync(path.join(__dirname,'..'));
const json=(p,o)=>fs.writeFileSync(p,JSON.stringify(o,null,2)+'\n',{flag:'wx'});
const read=p=>fs.readFileSync(p);
function outside(p){const rel=path.relative(root,p);assert.ok(rel==='..'||rel.startsWith('..'+path.sep)||path.isAbsolute(rel),'Consumer work/report directory must be outside editor project');}
function main(){
    const [major,...rest]=process.argv.slice(2);assert.ok(['18','19'].includes(major)&&!rest.length,'Usage: npm run test:consumer -- 18|19');
    const npm=fs.realpathSync(process.env.npm_execpath||'');assert.equal(path.basename(npm),'npm-cli.js','Run through npm');
    const npmVersion=/^npm\/([^\s]+)/.exec(process.env.npm_config_user_agent||'')?.[1];const runtime=validateRuntime(process.versions.node,npmVersion);
    const temp=fs.realpathSync(os.tmpdir());outside(temp);
    let report;
    if(process.env.CONSUMER_REPORT_DIR){const target=path.resolve(process.env.CONSUMER_REPORT_DIR);outside(target);const parent=fs.realpathSync(path.dirname(target));outside(parent);report=path.join(parent,path.basename(target));fs.mkdirSync(report);}
    else report=fs.mkdtempSync(path.join(temp,'Tiptap-F2E-React'+major+'-evidence-'));
    console.log('Evidence: '+report);
    const work=fs.mkdtempSync(path.join(temp,'Tiptap-F2E-React'+major+'-work-'));outside(work);
    const before=Object.fromEntries(['package.json','package-lock.json'].map(n=>[n,sha(read(path.join(root,n)))]));
    const env={...process.env,PLAYWRIGHT_BROWSERS_PATH:path.join(work,'browsers'),PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD:'1'};
    // Do not allow inherited npm flags to silently skip required peer/engine checks or change the install mode.
    const strict=['--registry=https://registry.npmjs.org','--engine-strict','--strict-peer-deps','--force=false','--legacy-peer-deps=false','--include=dev','--include=optional','--package-lock=true','--workspaces=false'];
    let stage='consumer-preflight';const completedCommands=[];const started=Date.now();
    function run(label,args,cwd=root,{jsonOutput=false}={}){
        stage=label;console.log('Running '+label+' ...');
        const result=spawnSync(process.execPath,[npm,...args],{cwd,env,encoding:'utf8',maxBuffer:32*1024*1024,timeout:10*60*1000,windowsHide:true});
        fs.writeFileSync(path.join(report,label+(jsonOutput?'.json':'.log')),jsonOutput?(result.stdout||''):(result.stdout||'')+(result.stderr||''),{flag:'wx'});
        if(jsonOutput&&result.stderr)fs.writeFileSync(path.join(report,label+'.stderr.log'),result.stderr,{flag:'wx'});
        if(result.error||result.status!==0){console.error((result.stdout||'').slice(-6000));console.error((result.stderr||'').slice(-6000));throw Error(label+' failed: '+(result.error?.message||result.status));}
        if(!jsonOutput&&result.stdout)console.log(result.stdout.trimEnd());
        const output=jsonOutput?JSON.parse(result.stdout):result.stdout;completedCommands.push(label);return output;
    }
    try{
        const manifest=readJson(path.join(root,'package.json')),lock=readJson(path.join(root,'package-lock.json')),p=plan(major,manifest,lock);
        run('library-types',['run','check:types']);run('library-bundle',['run','check:bundle']);
        const dist=inventory(path.join(root,'dist'));assert.equal(dist.length,39,'Expected verified 39-file distribution');
        const pack=run('pack',['pack','--ignore-scripts','--json','--pack-destination',work],root,{jsonOutput:true});
        const filename=packInventory(pack,dist), archive=path.join(work,'editor.tgz');fs.renameSync(path.join(work,filename),archive);
        const archiveBytes=read(archive);assert.equal(pack[0].integrity,'sha512-'+require('node:crypto').createHash('sha512').update(archiveBytes).digest('base64'));
        json(path.join(work,'package.json'),p.manifest);json(path.join(report,'consumer-manifest.json'),p.manifest);
        for(const name of ['index.html','main.tsx','browser.mjs','formatting.mjs','blocks.mjs','lists.mjs','links-typography.mjs','history.mjs','synchronization.mjs','media.mjs','rich-blocks.mjs','source-security.mjs','responsive.mjs'])fs.copyFileSync(path.join(root,'tests/Consumer',name),path.join(work,name));
        fs.copyFileSync(path.join(root,'tools/browser-evidence.cjs'),path.join(work,'browser-evidence.cjs'));
        fs.copyFileSync(path.join(root,'tests/TypeScript/public-api.tsx'),path.join(work,'public-api.tsx'));
        const config={compilerOptions:{target:'ES2022',lib:['ES2022','DOM','DOM.Iterable'],module:'ESNext',moduleResolution:'Bundler',jsx:'react-jsx',strict:true,noEmit:true,noEmitOnError:true,skipLibCheck:false,types:['vite/client'],esModuleInterop:true,forceConsistentCasingInFileNames:true,noUncheckedSideEffectImports:true},files:['main.tsx','public-api.tsx'],include:['node_modules/@microweb/laravel-tiptap-editor/dist/**/*.d.ts']};
        json(path.join(work,'tsconfig.json'),config);json(path.join(work,'tsconfig.nodenext.json'),{extends:'./tsconfig.json',compilerOptions:{module:'NodeNext',moduleResolution:'NodeNext',skipLibCheck:true}});
        run('resolve',['install','--package-lock-only','--ignore-scripts','--audit=false',...strict],work);
        const lockPath=path.join(work,'package-lock.json'),consumerLock=readJson(lockPath);fs.copyFileSync(lockPath,path.join(report,'consumer-lock.json'));
        verifyLock(consumerLock,p.expected,archiveBytes);
        const lockHash=sha(read(lockPath));
        run('install',['ci','--ignore-scripts=false','--audit=false',...strict],work);
        const tree=run('installed-tree',['ls','--all','--json'],work,{jsonOutput:true});assert.ok(!tree.problems?.length,'Invalid installed tree');
        const verified=verifyInstalled(work,root,p.expected,readJson(lockPath),archiveBytes);
        for(const [name,args] of [['audit-all',[]],['audit-runtime',['--omit=dev']]])cleanAudit(run(name,['audit','--json','--audit-level=low','--registry=https://registry.npmjs.org',...args],work,{jsonOutput:true}));
        run('consumer-typecheck',['run','typecheck'],work);run('consumer-build',['run','build'],work);
        // Use the exact local Playwright CLI, never npx fallback or a globally installed browser.
        const playwright=path.join(work,'node_modules','playwright','cli.js');
        function nodeRun(label,args){stage=label;console.log('Running '+label+' ...');const r=spawnSync(process.execPath,args,{cwd:work,env:{...env,PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD:'0'},encoding:'utf8',maxBuffer:32*1024*1024,timeout:10*60*1000,windowsHide:true});fs.writeFileSync(path.join(report,label+'.log'),(r.stdout||'')+(r.stderr||''),{flag:'wx'});console.log((r.stdout||'').trimEnd());if(r.error||r.status!==0){console.error(r.stderr);throw Error(label+' failed: '+(r.error?.message||r.status));}completedCommands.push(label);}
        if(process.platform==='linux'&&process.env.GITHUB_ACTIONS==='true')nodeRun('chromium-dependencies',[playwright,'install-deps','chromium']);
        nodeRun('chromium-install',[playwright,'install','chromium']);
        nodeRun('browser',['browser.mjs',p.expected.react,path.join(report,'browser-summary.json')]);
        stage='browser-evidence';const browser=readJson(path.join(report,'browser-summary.json'));
        const browserChecks=verifyBrowserEvidence(browser,p.expected.react);
        console.log('Browser evidence verified: '+browserChecks+' check groups');
        stage='final-integrity';
        assert.equal(sha(read(lockPath)),lockHash,'Consumer lock changed');
        for(const [n,h] of Object.entries(before))assert.equal(sha(read(path.join(root,n))),h,'Editor baseline modified: '+n);
        json(path.join(report,'consumer-summary.json'),{status:'passed',lane:major,...runtime,platform:process.platform,commit:process.env.GITHUB_SHA||null,editor:before,archive_sha256:sha(archiveBytes),consumer_lock_sha256:lockHash,...verified,audits:'clean',browser});
        json(path.join(report,'run-status.json'),{schema:1,status:'passed',lane:major,commit:process.env.GITHUB_SHA||null,stage:'complete',completedCommands,browserChecks,elapsedMs:Date.now()-started});
        console.log('React '+major+' consumer compatibility PASSED. Evidence: '+report);
    }catch(e){try{json(path.join(report,'run-status.json'),{schema:1,status:'failed',lane:major,commit:process.env.GITHUB_SHA||null,stage,category:stageCategory(stage),completedCommands,error:String(e.message||e).slice(0,4000),elapsedMs:Date.now()-started});}catch(writeError){console.error('Status evidence write failed: '+writeError.message);}
        console.error('Consumer work retained for diagnosis: '+work+'; evidence: '+report);throw e;}
    fs.rmSync(work,{recursive:true,force:true});
}
try{main();}catch(e){console.error('STOP: '+e.message);process.exitCode=1;}
