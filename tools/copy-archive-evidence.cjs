'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {hash,MAX_ARCHIVE}=require('./archive-contract.cjs');
const metadata=['archive-summary.json','pack.json','repeat-pack.json'];
function directory(p){const s=fs.lstatSync(p);assert.ok(s.isDirectory()&&!s.isSymbolicLink(),'Expected real directory: '+p);return fs.realpathSync(p);}
function readRegular(p){const s=fs.lstatSync(p);assert.ok(s.isFile()&&!s.isSymbolicLink()&&s.size>0&&s.size<=MAX_ARCHIVE,'Invalid evidence file: '+p);return fs.readFileSync(p);}
function copyArchiveEvidence(source,destination){
    const src=directory(source),dest=directory(destination);
    assert.notEqual(src,dest,'Source and destination must differ');
    const summary=JSON.parse(readRegular(path.join(src,metadata[0])));
    assert.equal(summary.status,'passed');assert.equal(summary.repeat_pack_identical,true);
    const archive=summary.archive;
    assert.match(archive.filename,/^microweb-laravel-tiptap-editor-\d+\.\d+\.\d+\.tgz$/);
    assert.equal(archive.entries,42);assert.equal(archive.dist_files,39);
    const names=[...metadata,archive.filename].sort();
    assert.deepEqual(fs.readdirSync(src).sort(),names,'Unexpected or missing archive evidence files');
    const snapshots=new Map(names.map(n=>[n,readRegular(path.join(src,n))]));
    const bytes=snapshots.get(archive.filename);
    assert.equal(bytes.length,archive.archive_bytes,'Archive size mismatch');
    assert.equal(hash(bytes),archive.sha256,'Archive digest mismatch');
    const existing=new Set(fs.readdirSync(dest).map(n=>n.toLowerCase()));
    for(const n of names)assert.ok(!existing.has(n.toLowerCase()),'Evidence destination collision: '+n);
    // Copy only the verified snapshots, exclusively. Do not merge directories with cpSync.
    for(const [n,b] of snapshots){
        const target=path.join(dest,n);
        fs.writeFileSync(target,b,{flag:'wx'});
        assert.ok(readRegular(target).equals(b),'Copied evidence mismatch: '+n);
    }
    return names;
}
module.exports={copyArchiveEvidence};
if(require.main===module){try{const [src,dest,...rest]=process.argv.slice(2);assert.ok(src&&dest&&!rest.length,'Usage: copy-archive-evidence.cjs <source> <destination>');const names=copyArchiveEvidence(src,dest);console.log('Archive evidence copied: '+names.length+' files; existing logs preserved.');}catch(e){console.error('STOP: '+e.message);process.exitCode=1;}}
