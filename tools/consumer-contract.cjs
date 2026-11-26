'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const NAME = '@microweb/laravel-tiptap-editor';
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const readJson = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const laneVersions = {
    '18': {react:'18.3.1','react-dom':'18.3.1','@types/react':'18.3.12','@types/react-dom':'18.3.0'},
    '19': {react:'19.3.1','react-dom':'19.3.1','@types/react':'19.3.0','@types/react-dom':'19.3.0'},
};
function plan(major, manifest, lock) {
    assert.ok(Object.hasOwn(laneVersions,major),'Expected React lane 18 or 19');
    assert.equal(manifest.name,NAME);
    const versions = laneVersions[major];
    const tiptap = Object.fromEntries(Object.entries(lock.packages).filter(([k])=>/^node_modules\/@tiptap\/[^/]+$/.test(k)).map(([k,v])=>[k.slice(13),v.version]));
    assert.equal(Object.keys(tiptap).length,32,'Unexpected accepted Tiptap inventory');
    assert.ok(Object.values(tiptap).every(v=>v==='3.32.0'),'Unexpected accepted Tiptap versions');
    const dependencies = {[NAME]:'file:./editor.tgz', react:versions.react,'react-dom':versions['react-dom']};
    for (const peer of Object.keys(manifest.peerDependencies)) {
        if (peer==='react'||peer==='react-dom') continue;
        assert.equal(tiptap[peer],'3.32.0','Unexpected peer: '+peer);
        dependencies[peer]=tiptap[peer];
    }
    const devDependencies = {'@types/react':versions['@types/react'],'@types/react-dom':versions['@types/react-dom'],typescript:'5.9.3',vite:'7.3.8',playwright:'1.65.1'};
    assert.equal(lock.packages['node_modules/typescript'].version,devDependencies.typescript);
    assert.equal(lock.packages['node_modules/vite'].version,devDependencies.vite);
    return {manifest:{name:'microweb-consumer-react-'+major,version:'0.0.0',private:true,type:'module',scripts:{typecheck:'tsc -p tsconfig.json && tsc -p tsconfig.nodenext.json',build:'vite build'},dependencies,devDependencies}, expected:{...versions,...tiptap,dompurify:'3.5.0',typescript:'5.9.3',vite:'7.3.8',playwright:'1.65.1',[NAME]:manifest.version}};
}
function packageName(key) { const m=/(?:^|\/)node_modules\/((?:@[^/]+\/)?[^/]+)$/.exec(key); assert.ok(m,'Unexpected lock path: '+key); return m[1]; }
function verifyLock(lock, expected, archiveBytes) {
    assert.equal(lock.lockfileVersion,3); const installed={};
    const singleton=n=>Object.hasOwn(expected,n)||n.startsWith('@tiptap/')||n.startsWith('prosemirror-');
    for(const [key,entry] of Object.entries(lock.packages)) {
        if(!key)continue;
        const n=packageName(key);
        assert.ok(!entry.link,'Linked dependency: '+key);
        if(n===NAME){assert.equal(entry.resolved,'file:editor.tgz');assert.equal(entry.integrity,'sha512-'+crypto.createHash('sha512').update(archiveBytes).digest('base64'),'Archive integrity mismatch');}
        else {const url=new URL(entry.resolved);assert.equal(url.origin,'https://registry.npmjs.org','Unexpected registry: '+key);assert.match(entry.integrity,/^sha512-[A-Za-z0-9+/]+={0,2}$/,'Missing integrity: '+key);}
        if(singleton(n)){assert.equal(key,'node_modules/'+n,'Nested singleton: '+key);assert.ok(!Object.hasOwn(installed,n),'Duplicate singleton: '+n);installed[n]=entry.version;}
        if(n.startsWith('@tiptap/'))assert.ok(Object.hasOwn(expected,n),'Unexpected Tiptap dependency: '+n);
    }
    for(const [n,v] of Object.entries(expected))assert.equal(installed[n],v,'Wrong or missing version: '+n);
    return installed;
}
function inventory(root, relative='') {
    const out=[];for(const e of fs.readdirSync(path.join(root,relative),{withFileTypes:true})){
        const key=path.posix.join(relative,e.name);assert.ok(!e.isSymbolicLink(),'Symlink: '+key);
        if(e.isDirectory())out.push(...inventory(root,key));else {assert.ok(e.isFile(),'Unexpected file: '+key);out.push(key);}
    }return out.sort();
}
function packInventory(pack, distFiles) {
    assert.ok(Array.isArray(pack)&&pack.length===1,'Expected one packed archive');
    const p=pack[0];assert.equal(p.name,NAME);assert.match(p.filename,/^microweb-laravel-tiptap-editor-[0-9]+\.[0-9]+\.[0-9]+\.tgz$/);
    const expected=['LICENSE','README.md','package.json',...distFiles.map(n=>'dist/'+n)].sort();
    assert.deepEqual(p.files.map(f=>f.path).sort(),expected,'Unexpected pack inventory');return p.filename;
}
function verifyInstalled(work, source, expected, lock, archiveBytes) {
    const singleton=verifyLock(lock,expected,archiveBytes);
    for(const [n,v] of Object.entries(singleton)) {
        const dir=path.join(work,'node_modules',n);
        assert.equal(fs.realpathSync(dir),dir,'Unexpected package symlink or redirect: '+n);
        assert.equal(readJson(path.join(dir,'package.json')).version,v,'Installed version mismatch: '+n);
    }
    const editor=path.join(work,'node_modules',NAME);
    const distFiles=inventory(path.join(source,'dist'));
    assert.deepEqual(inventory(path.join(editor,'dist')),distFiles,'Installed dist inventory mismatch');
    const hashes={};for(const n of distFiles){const a=fs.readFileSync(path.join(source,'dist',n)),b=fs.readFileSync(path.join(editor,'dist',n));assert.deepEqual(b,a,'Installed dist mismatch: '+n);hashes[n]=sha(b);}
    const original=readJson(path.join(source,'package.json')), actual=readJson(path.join(editor,'package.json'));
    for(const key of ['name','version','type','main','module','types','exports','sideEffects','peerDependencies','dependencies','engines'])assert.deepEqual(actual[key],original[key],'Packed manifest mismatch: '+key);
    return {singleton,dist_hashes:hashes};
}
module.exports={NAME,plan,verifyLock,packInventory,verifyInstalled,inventory,sha,readJson};
