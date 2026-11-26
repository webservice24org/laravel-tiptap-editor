'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const assert = require('node:assert/strict');
const ts = require('typescript');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const values = ['TiptapEditor','createEditorExtensions','default','sanitizeEditorHtml'].sort();
const licenseNames = ['LICENSE','LICENSE-MPL'];
const budgets = { 'index.js': {bytes: 280*1024,gzip: 65*1024}, 'editor.css': {bytes: 48*1024,gzip: 12*1024}, 'index.js.map': {bytes: 1024*1024} };
const markers = ['.mw-tiptap-editor','.mw-tiptap-toolbar','.mw-tiptap-content','.mw-tiptap-image-figure','.mw-tiptap-video-figure','.mw-news-block','.mw-dialog'];
const normalize = text => text.replace(/\r\n/g,'\n');
function peerImport(id, peers) { return peers.some(name => id===name||id.startsWith(name+'/')); }
function analyzeJs(text, peers, version) {
    const source=ts.createSourceFile('index.js',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
    assert.equal(source.parseDiagnostics.length,0,'Invalid JavaScript syntax');
    const imports=[],exports=[],versions=[];
    function walk(node) {
        if (ts.isImportDeclaration(node)) {
            assert.ok(ts.isStringLiteral(node.moduleSpecifier),'Invalid import');
            const id=node.moduleSpecifier.text;
            assert.ok(peerImport(id,peers),'Unexpected runtime import: '+id);
            imports.push(id);
        }
        if (ts.isExportDeclaration(node)) {
            assert.ok(!node.moduleSpecifier && node.exportClause && ts.isNamedExports(node.exportClause),'Unexpected re-export');
            for(const element of node.exportClause.elements) exports.push(element.name.text);
        }
        if (ts.isCallExpression(node)) {
            assert.ok(node.expression.kind!==ts.SyntaxKind.ImportKeyword && !(ts.isIdentifier(node.expression)&&node.expression.text==='require'),'Unexpected dynamic or CommonJS dependency');
        }
        if (ts.isBinaryExpression(node)&&node.operatorToken.kind===ts.SyntaxKind.EqualsToken&&ts.isStringLiteral(node.right)) {
            const left=node.left;
            const versionProperty=ts.isPropertyAccessExpression(left)&&left.name.text==='version' || ts.isElementAccessExpression(left)&&ts.isStringLiteral(left.argumentExpression)&&left.argumentExpression.text==='version';
            if (versionProperty && /^\d+\.\d+\.\d+$/.test(node.right.text)) versions.push(node.right.text);
        }
        ts.forEachChild(node,walk);
    }
    walk(source);
    assert.deepEqual(exports.sort(),values,'Unexpected runtime exports');
    assert.ok(imports.includes('react')&&imports.includes('react/jsx-runtime')&&imports.includes('@tiptap/react')&&imports.includes('@tiptap/core'),'Missing expected external peer imports');
    assert.deepEqual([...new Set(versions)],[version],'Compiled DOMPurify version marker mismatch');
    assert.ok(/\/\/# sourceMappingURL=index\.js\.map\s*$/.test(text) && (text.match(/\/\/# sourceMappingURL=/g)||[]).length===1,'Missing or unexpected source-map link');
    return {imports:[...new Set(imports)].sort(),exports,compiled_dompurify:version};
}
function checkCss(text) {
    for(const marker of markers) assert.ok(new RegExp(marker.replace('.','\\.')+'(?![\\w-])').test(text),'Missing CSS selector: '+marker);
    assert.ok(!/@import\b/i.test(text),'Unexpected CSS import');
}
function verifyMap(map, js, readLocal) {
    assert.equal(map.version,3,'Invalid source map version');
    assert.equal(map.file,'index.js','Unexpected source map target');
    assert.ok(!map.sourceRoot,'Unexpected sourceRoot');
    assert.ok(Array.isArray(map.sources)&&map.sources.length>0&&new Set(map.sources).size===map.sources.length,'Invalid source inventory');
    assert.ok(Array.isArray(map.names)&&map.names.every(n=>typeof n==='string'),'Invalid map names');
    assert.ok(Array.isArray(map.sourcesContent)&&map.sourcesContent.length===map.sources.length,'Missing source map content');
    let vendor=0,editor=0;
    for(const [i,id] of map.sources.entries()) {
        assert.ok(typeof id==='string'&&!id.includes('\\')&&path.posix.normalize(id)===id,'Unsafe source map path: '+id);
        assert.ok(typeof map.sourcesContent[i]==='string'&&map.sourcesContent[i].length>0,'Empty source map content: '+id);
        if(id.startsWith('../resources/js/')||id.startsWith('../resources/css/')) {
            assert.equal(normalize(map.sourcesContent[i]),normalize(readLocal(id.slice(3))),'Source map content mismatch: '+id); editor++;
        } else {
            assert.ok(id.startsWith('../node_modules/dompurify/'),'Unexpected source map dependency or path: '+id);
            if (id==='../node_modules/dompurify/dist/purify.es.mjs') {
                const withoutLink = t => normalize(t).replace(/\/\/# sourceMappingURL=[^\n]*\s*$/, '').trimEnd();
                assert.equal(withoutLink(map.sourcesContent[i]),withoutLink(readLocal(id.slice(3))),'Mapped DOMPurify source differs from installed ESM file');
            }
            vendor++;
        }
    }
    assert.ok(editor&&vendor,'Missing editor or sanitizer source mappings');
    // Decode VLQ segment structure and check bounds. This is not a semantic map proof.
    assert.ok(typeof map.mappings==='string'&&map.mappings.length>0,'Missing source mappings');
    const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const generated=normalize(js).split('\n');
    const original=map.sourcesContent.map(s=>normalize(s).split('\n'));
    let src=0,line=0,col=0,name=0,segments=0;const mapped=new Set();
    for(const [i,row] of map.mappings.split(';').entries()) {
        if(!row) continue;
        assert.ok(i<generated.length,'Generated mapping line out of range');
        let gen=0;
        for(const segment of row.split(',')) {
            const nums=[]; let v=0,shift=0;
            for(const ch of segment) {
                const d=alphabet.indexOf(ch); assert.ok(d>=0&&shift<=30,'Invalid VLQ mapping');
                v+=(d&31)*2**shift; shift+=5;
                if(!(d&32)){nums.push((v&1)?-Math.floor(v/2):Math.floor(v/2));v=0;shift=0;}
            }
            assert.ok(shift===0&&[1,4,5].includes(nums.length),'Invalid mapping segment');
            gen+=nums[0]; assert.ok(nums[0]>=0&&gen<=generated[i].length,'Generated mapping column out of range');
            if(nums.length>1) {
                src+=nums[1];line+=nums[2];col+=nums[3];
                assert.ok(src>=0&&src<original.length&&line>=0&&line<original[src].length&&col>=0&&col<=original[src][line].length,'Original mapping position out of range');
                mapped.add(src);
                if(nums.length===5){name+=nums[4];assert.ok(name>=0&&name<map.names.length,'Mapping name out of range');}
                segments++;
            }
        }
    }
    assert.ok(segments>0&&[...mapped].some(i=>map.sources[i].startsWith('../node_modules/dompurify/'))&&[...mapped].some(i=>map.sources[i].startsWith('../resources/')),'Missing mapped editor or sanitizer content');
    return {sources:map.sources.length,editor_sources:editor,dompurify_sources:vendor,mapped_segments:segments};
}
function measure(name, bytes) {
    assert.ok(bytes.length>0,'Empty output: '+name);
    const gzip=zlib.gzipSync(bytes,{level:9}).length;
    const budget=budgets[name];
    if(budget){assert.ok(bytes.length<=budget.bytes,'Raw size budget exceeded: '+name);if(budget.gzip)assert.ok(gzip<=budget.gzip,'Gzip size budget exceeded: '+name);}
    return {bytes:bytes.length,gzip_bytes:gzip,sha256:sha(bytes)};
}
function listFiles(dir,rel='') {
    const out=[];for(const e of fs.readdirSync(path.join(dir,rel),{withFileTypes:true})) {
        const n=path.posix.join(rel,e.name);
        if(e.isDirectory())out.push(...listFiles(dir,n));else{assert.ok(e.isFile()&&!e.isSymbolicLink(),'Unexpected filesystem object: '+n);out.push(n);}
    }return out.sort();
}
function verifyInventory(files) {
    const runtime=['index.js','index.js.map','editor.css',...licenseNames.map(n=>'third-party/dompurify-'+n+'.txt')].sort();
    assert.deepEqual(files.filter(n=>!n.endsWith('.d.ts')).sort(),runtime,'Unexpected runtime output inventory');
    assert.ok(files.includes('index.d.ts'),'Missing public declaration');
}
function verifyManifest(manifest) {
    assert.equal(manifest.type,'module'); assert.equal(manifest.main,'./dist/index.js'); assert.equal(manifest.module,manifest.main);
    assert.equal(manifest.exports['.'].import,manifest.main); assert.equal(manifest.exports['.'].types,'./dist/index.d.ts');
    assert.equal(manifest.exports['./editor.css'],'./dist/editor.css'); assert.ok(manifest.sideEffects.includes('./dist/editor.css'));
    assert.ok(manifest.files.includes('dist')); assert.equal(manifest.dependencies.dompurify,'3.5.0');
}
function main() {
    const [report,...extra]=process.argv.slice(2); assert.ok(!extra.length,'Usage: node tools/bundle-contract.cjs [report.json]');
    const root=path.resolve(__dirname,'..'), dist=path.join(root,'dist');
    const read=n=>fs.readFileSync(path.join(root,n)); const json=n=>JSON.parse(read(n));
    const manifest=json('package.json'),lock=json('package-lock.json'),version=manifest.dependencies.dompurify;
    verifyManifest(manifest); assert.equal(lock.packages['node_modules/dompurify'].version,version);
    assert.equal(json('node_modules/dompurify/package.json').version,version);
    assert.ok(fs.lstatSync(dist).isDirectory()&&!fs.lstatSync(dist).isSymbolicLink(),'Unsafe dist root');
    const files=listFiles(dist);verifyInventory(files);
    const outputs={};for(const n of files.filter(n=>!n.endsWith('.d.ts')))outputs[n]=measure(n,read('dist/'+n));
    const js=read('dist/index.js').toString('utf8');const contract=analyzeJs(js,Object.keys(manifest.peerDependencies),version);
    checkCss(read('dist/editor.css').toString('utf8'));
    const sourcemap=verifyMap(json('dist/index.js.map'),js,n=>read(n).toString('utf8'));
    for(const n of licenseNames)assert.deepEqual(read('dist/third-party/dompurify-'+n+'.txt'),read('node_modules/dompurify/'+n),'DOMPurify license copy mismatch');
    const summary={status:'passed',...contract,sourcemap,outputs,budgets,declaration_files:files.filter(n=>n.endsWith('.d.ts')).length};
    if(report)fs.writeFileSync(report,JSON.stringify(summary,null,2)+'\n',{flag:'wx'});
    console.log(`Bundle contract verified: DOMPurify ${version}, ${contract.exports.length} runtime exports, ${sourcemap.sources} mapped sources, ${outputs['index.js'].bytes} JS bytes (${outputs['index.js'].gzip_bytes} gzip), ${outputs['editor.css'].bytes} CSS bytes.`);
}
module.exports={peerImport,analyzeJs,checkCss,verifyMap,measure,verifyInventory,verifyManifest};
if(require.main===module){try{main();}catch(e){console.error('STOP: '+e.message);process.exitCode=1;}}
