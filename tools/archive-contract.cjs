'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { NAME, inventory, packInventory, readJson } = require('./consumer-contract.cjs');
const MAX_ARCHIVE = 2 * 1024 * 1024, MAX_TAR = 4 * 1024 * 1024;
const hash = (b, algorithm='sha256', encoding='hex') => crypto.createHash(algorithm).update(b).digest(encoding);
const zero = b => b.every(v=>v===0);
function field(b) {
    const end=b.indexOf(0), value=end<0?b:b.subarray(0,end);
    assert.ok(end<0||zero(b.subarray(end)), 'Nonzero TAR string padding');
    assert.ok(value.every(v=>v>=32&&v<=126),'Non-ASCII TAR field');
    return value.toString('ascii');
}
function octal(b) {
    const s=b.toString('latin1').replace(/[\x00 ]+$/,'').replace(/^ +/,'');
    assert.match(s,/^[0-7]+$/,'Invalid TAR numeric field');
    const n=parseInt(s,8); assert.ok(Number.isSafeInteger(n),'TAR numeric overflow'); return n;
}
function canonical(name) {
    assert.ok(name.startsWith('package/'),'Unexpected TAR root');
    const relative=name.slice(8);
    assert.ok(relative.length>0&&relative.split('/').every(p=>/^[A-Za-z0-9_@.-]+$/.test(p)&&p!=='.'&&p!=='..'&&!p.endsWith('.')),'Unsafe TAR path: '+name);
    return relative;
}
// Deliberately restricted reader for npm's small regular-file ustar archives.
// No extraction, path rewriting, PAX extensions, links, or special files.
function readArchive(bytes) {
    assert.ok(Buffer.isBuffer(bytes)&&bytes.length>0&&bytes.length<=MAX_ARCHIVE,'Invalid compressed archive size');
    const tar=zlib.gunzipSync(bytes,{maxOutputLength:MAX_TAR});
    assert.ok(tar.length%512===0,'Truncated TAR block');
    const files=new Map(), folded=new Set();let offset=0;
    while(offset+512<=tar.length) {
        const h=tar.subarray(offset,offset+512);offset+=512;
        if(zero(h)) {
            assert.ok(offset+512<=tar.length&&zero(tar.subarray(offset)),'Invalid TAR end marker or trailing data');
            assert.ok(files.size>0,'Empty TAR');return files;
        }
        assert.equal(h.subarray(257,265).toString('latin1'),'ustar\x0000','Unsupported TAR format');
        const checksum=h.reduce((sum,v,i)=>sum+(i>=148&&i<156?32:v),0);
        assert.equal(octal(h.subarray(148,156)),checksum,'Invalid TAR header checksum');
        assert.ok(h[156]===48||h[156]===0,'Non-regular TAR entry');
        assert.ok(zero(h.subarray(157,257)),'Unexpected TAR link target');
        const prefix=field(h.subarray(345,500)), name=canonical((prefix?prefix+'/':'')+field(h.subarray(0,100)));
        assert.ok(!folded.has(name.toLowerCase()),'Duplicate or case-colliding TAR path: '+name);folded.add(name.toLowerCase());
        assert.ok(files.size<100,'Too many TAR entries');
        const size=octal(h.subarray(124,136)), mode=octal(h.subarray(100,108));
        assert.ok(size>0&&size<=MAX_TAR&&!(mode&0o7111),'Empty or executable/special TAR entry: '+name);
        const padded=Math.ceil(size/512)*512;
        assert.ok(offset+padded<=tar.length,'Truncated TAR payload');
        assert.ok(zero(tar.subarray(offset+size,offset+padded)),'Nonzero TAR payload padding');
        files.set(name,tar.subarray(offset,offset+size));offset+=padded;
    }
    throw Error('Missing TAR end marker');
}
function expectedFiles(root) {
    const dist=path.join(root,'dist'), d=fs.lstatSync(dist);
    assert.ok(d.isDirectory()&&!d.isSymbolicLink(),'Unsafe dist root');
    const names=inventory(dist);assert.equal(names.length,39,'Expected 39 verified dist files');
    const expected=['LICENSE','README.md','package.json',...names.map(n=>'dist/'+n)].sort();
    assert.equal(new Set(expected.map(n=>n.toLowerCase())).size,42,'Case-colliding distribution');
    const files=new Map();for(const n of expected){canonical('package/'+n);const p=path.join(root,n);const s=fs.lstatSync(p);assert.ok(s.isFile()&&!s.isSymbolicLink()&&s.size>0&&s.size<=MAX_TAR,'Unsafe or empty source file: '+n);files.set(n,fs.readFileSync(p));}
    return files;
}
function verifyArchive(bytes, expected, pack) {
    const actual=readArchive(bytes);
    assert.deepEqual([...actual.keys()].sort(),[...expected.keys()].sort(),'Archive file inventory mismatch');
    const entries=[];
    for(const [n,b] of [...expected.entries()].sort(([a],[b])=>a<b?-1:a>b?1:0)) {
        assert.ok(actual.get(n).equals(b),'Archive bytes mismatch: '+n);
        entries.push({path:n,bytes:b.length,sha256:hash(b)});
    }
    const manifest=JSON.parse(expected.get('package.json'));
    assert.equal(manifest.name,NAME);assert.match(manifest.version,/^\d+\.\d+\.\d+$/);
    assert.equal(manifest.dependencies.dompurify,'3.5.0');
    assert.equal(manifest.main,'./dist/index.js');assert.equal(manifest.module,manifest.main);assert.equal(manifest.types,'./dist/index.d.ts');
    assert.deepEqual(manifest.exports,{'.':{types:manifest.types,import:manifest.main},'./editor.css':'./dist/editor.css'});
    assert.deepEqual(manifest.files,['dist','README.md','LICENSE']);
    const filename=packInventory(pack,[...expected.keys()].filter(n=>n.startsWith('dist/')).map(n=>n.slice(5)));
    assert.equal(filename,'microweb-laravel-tiptap-editor-'+manifest.version+'.tgz');
    const p=pack[0], integrity='sha512-'+hash(bytes,'sha512','base64');
    assert.equal(p.id,NAME+'@'+manifest.version);assert.equal(p.version,manifest.version);
    assert.equal(p.size,bytes.length);assert.equal(p.unpackedSize,entries.reduce((s,e)=>s+e.bytes,0));
    assert.equal(p.entryCount,entries.length);assert.equal(p.integrity,integrity);assert.equal(p.shasum,hash(bytes,'sha1'));
    const sizes=new Map(entries.map(e=>[e.path,e.bytes]));for(const f of p.files)assert.equal(f.size,sizes.get(f.path),'Pack metadata size mismatch: '+f.path);
    return {name:NAME,version:manifest.version,filename,entries:entries.length,dist_files:entries.filter(e=>e.path.startsWith('dist/')).length,archive_bytes:bytes.length,unpacked_bytes:p.unpackedSize,sha256:hash(bytes),sha512:hash(bytes,'sha512'),integrity,files:entries};
}
module.exports={readArchive,expectedFiles,verifyArchive,hash,MAX_ARCHIVE,MAX_TAR};
