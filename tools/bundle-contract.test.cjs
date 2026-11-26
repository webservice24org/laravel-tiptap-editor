'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require('typescript');
const {peerImport,analyzeJs,checkCss,verifyMap,measure,verifyInventory,verifyManifest}=require('./bundle-contract.cjs');
const root=path.resolve(__dirname,'..');
const manifest=require('../package.json');
const peers=Object.keys(manifest.peerDependencies);
const js=`import a from 'react'; import b from 'react/jsx-runtime'; import c from '@tiptap/react'; import d from '@tiptap/core';
const s={};s.version='3.5.0'; export {a as default,a as TiptapEditor,b as sanitizeEditorHtml,c as createEditorExtensions};
//# sourceMappingURL=index.js.map\n`;
const css='.mw-tiptap-editor{}.mw-tiptap-toolbar{}.mw-tiptap-content{}.mw-tiptap-image-figure{}.mw-tiptap-video-figure{}.mw-news-block{}.mw-dialog{}';
const map=()=>({version:3,file:'index.js',sources:['../resources/js/index.ts','../node_modules/dompurify/dist/purify.es.mjs'],sourcesContent:['hello','world'],names:[],mappings:'AAAA,CCAA'});
const inventory=['index.js','editor.css','index.js.map','index.d.ts','third-party/dompurify-LICENSE.txt','third-party/dompurify-LICENSE-MPL.txt'];
const inspect=(text=js)=>analyzeJs(text,peers,'3.5.0');
const mapped=m=>verifyMap(m,'ab',n=> n.startsWith('node_modules/')?'world':'hello');
test('exact peer and subpath matching',()=>{assert.ok(peerImport('react/jsx-runtime',peers));assert.ok(peerImport('@tiptap/pm/state',peers));assert.ok(!peerImport('react-extra',peers));assert.ok(!peerImport('@tiptap/undeclared',peers));});
test('accept expected ESM contract',()=>{assert.equal(inspect().compiled_dompurify,'3.5.0');assert.equal(inspect().exports.length,4);});
test('reject external sanitizer',()=>assert.throws(()=>inspect(js+"import p from 'dompurify';"),/Unexpected runtime import/));
test('reject undeclared dependency',()=>assert.throws(()=>inspect(js+"import p from 'react-other';"),/Unexpected runtime import/));
test('reject stale sanitizer',()=>assert.throws(()=>inspect(js.replace('3.5.0','3.4.17')),/version marker/));
test('reject missing version assignment despite comment',()=>assert.throws(()=>inspect(js.replace("s.version='3.5.0'","/* 3.5.0 */")),/version marker/));
test('reject missing exports',()=>assert.throws(()=>inspect(js.replace(',c as createEditorExtensions','')),/runtime exports/));
test('reject dynamic import',()=>assert.throws(()=>inspect(js.replace('const s','import("react"); const s')),/dynamic or CommonJS/));
test('reject require',()=>assert.throws(()=>inspect(js.replace('const s','require("react"); const s')),/dynamic or CommonJS/));
test('reject wrong map link',()=>assert.throws(()=>inspect(js.replace('index.js.map','wrong.map')),/source-map link/));
test('accept stylesheet markers',()=>checkCss(css));
test('reject missing stylesheet marker',()=>assert.throws(()=>checkCss(css.replace('.mw-dialog','')),/Missing CSS selector/));
test('reject CSS imports',()=>assert.throws(()=>checkCss(css+'@import "foo.css";'),/Unexpected CSS import/));
test('accept bounded map and both mapped origins',()=>assert.equal(mapped(map()).mapped_segments,2));
test('reject invalid mapping VLQ',()=>assert.throws(()=>mapped({...map(),mappings:'g'}),/mapping segment/));
test('reject invalid mapping source index',()=>assert.throws(()=>mapped({...map(),mappings:'AEAA'}),/Original mapping position/));
test('reject generated mapping column overflow',()=>assert.throws(()=>mapped({...map(),mappings:'UAAA'}),/Generated mapping column/));
test('reject unknown map dependency',()=>assert.throws(()=>mapped({...map(),sources:['../resources/js/index.ts','../node_modules/react/index.js']}),/Unexpected source map/));
test('reject noncanonical and absolute map paths',()=>{for(const id of ['../resources/js/../../secret','C:/private.js','/tmp/private.js','../resources/js/../secret'])assert.throws(()=>mapped({...map(),sources:['../resources/js/index.ts',id]}),/source map/i);});
test('reject stale editor source content',()=>assert.throws(()=>mapped({...map(),sourcesContent:['other','world']}),/content mismatch/));
test('reject mismatched mapped sanitizer source',()=>assert.throws(()=>mapped({...map(),sourcesContent:['hello','stale']}),/Mapped DOMPurify source/));
test('reject unmapped sanitizer',()=>assert.throws(()=>mapped({...map(),mappings:'AAAA'}),/Missing mapped/));
test('size and hash evidence',()=>{const b=measure('index.js',Buffer.from('hello'));assert.equal(b.bytes,5);assert.match(b.sha256,/^[a-f0-9]{64}$/);assert.ok(b.gzip_bytes>0);});
test('reject oversize and empty outputs',()=>{assert.throws(()=>measure('index.js',Buffer.alloc(281*1024)),/Raw size budget/);assert.throws(()=>measure('editor.css',Buffer.alloc(0)),/Empty output/);});
test('accept exact runtime inventory',()=>verifyInventory(inventory));
test('reject stray outputs and missing licenses',()=>{assert.throws(()=>verifyInventory([...inventory,'chunk.js']),/inventory/);assert.throws(()=>verifyInventory(inventory.slice(0,-1)),/inventory/);});
test('manifest preserves module and stylesheet contract',()=>{verifyManifest(manifest);const m=structuredClone(manifest);m.exports['./editor.css']='./wrong.css';assert.throws(()=>verifyManifest(m));});
// Run the actual Vite hook using a transpiled config and minimal test doubles.
// This does not replace executing Vite against the real dependency tree.
function plugin(version='3.5.0') {
    const code=ts.transpileModule(fs.readFileSync(path.join(root,'vite.config.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText;
    const module={exports:{}};
    vm.runInNewContext(code,{exports:module.exports,module,__dirname:root,require:id=>{
        if(id==='vite')return {defineConfig:c=>c};
        if(id==='@vitejs/plugin-react')return ()=>({name:'fake-react'});
        if(id==='./package.json')return manifest;
        if(id==='node:fs')return {readFileSync:p=>String(p).endsWith('package.json')?JSON.stringify({version}):Buffer.from('test-only license')};
        if(id==='node:path')return path;
        throw Error('Unexpected test module '+id);
    }});
    return module.exports.default.plugins[1];
}
function chunk(){return {type:'chunk',fileName:'index.js',isEntry:true,imports:['react','@tiptap/core'],dynamicImports:[],modules:{'/project/resources/js/index.ts':{renderedLength:5},'/project/node_modules/dompurify/dist/purify.es.mjs':{renderedLength:100}}};}
function runHook(p,bundle){const assets=[];p.generateBundle.call({error:m=>{throw Error(m)},emitFile:a=>assets.push(a)}, {}, bundle);return assets;}
test('Vite hook accepts rendered graph and emits two license assets',()=>{const a=runHook(plugin(),{'index.js':chunk()});assert.equal(a.length,2);assert.equal(a[0].fileName,'third-party/dompurify-LICENSE.txt');});
test('Vite hook rejects bundled React or other third party',()=>{const c=chunk();c.modules['C:\\project\\node_modules\\react\\index.js']={renderedLength:5};assert.throws(()=>runHook(plugin(),{x:c}),/Unexpected bundled dependency/);});
test('Vite hook rejects missing rendered sanitizer',()=>{const c=chunk();c.modules['/project/node_modules/dompurify/dist/purify.es.mjs'].renderedLength=0;assert.throws(()=>runHook(plugin(),{x:c}),/was not bundled/);});
test('Vite hook rejects unexpected external and extra chunks',()=>{const c=chunk();c.imports.push('dompurify');assert.throws(()=>runHook(plugin(),{x:c}),/Unexpected external import/);assert.throws(()=>runHook(plugin(),{x:chunk(),y:chunk()}),/one ESM/);});
test('Vite hook rejects installed sanitizer version mismatch',()=>assert.throws(()=>runHook(plugin('3.4.17'),{x:chunk()}),/Unexpected installed DOMPurify/));
