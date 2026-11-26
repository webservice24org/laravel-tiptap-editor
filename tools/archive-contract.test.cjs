'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),zlib=require('node:zlib'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {readArchive,verifyArchive,expectedFiles,hash,MAX_ARCHIVE,MAX_TAR}=require('./archive-contract.cjs');
function checksum(h){h.fill(32,148,156);const n=h.reduce((s,v)=>s+v,0);h.write(n.toString(8).padStart(6,'0')+'\0 ',148,'ascii');}
function entry(name,b,change){b=Buffer.from(b);const h=Buffer.alloc(512);h.write(name);h.write('0000644\0',100);h.write(b.length.toString(8).padStart(11,'0')+'\0',124);h[156]=48;h.write('ustar\x0000',257,'latin1');if(change)change(h);checksum(h);return Buffer.concat([h,b,Buffer.alloc((512-b.length%512)%512)]);}
const finish=(...entries)=>zlib.gzipSync(Buffer.concat([...entries,Buffer.alloc(1024)]));
const basic=()=>entry('package/LICENSE','license');
const one=()=>finish(basic());
const manifest={name:'@microweb/laravel-tiptap-editor',version:'1.0.0',type:'module',main:'./dist/index.js',module:'./dist/index.js',types:'./dist/index.d.ts',exports:{'.':{types:'./dist/index.d.ts',import:'./dist/index.js'},'./editor.css':'./dist/editor.css'},files:['dist','README.md','LICENSE'],dependencies:{dompurify:'3.5.0'}};
function fixture(){const expected=new Map([['LICENSE',Buffer.from('license')],['README.md',Buffer.from('readme')],['package.json',Buffer.from(JSON.stringify(manifest))],['dist/index.js',Buffer.from('js')],['dist/index.d.ts',Buffer.from('types')]]);const bytes=finish(...[...expected].map(([n,b])=>entry('package/'+n,b)));const p={name:manifest.name,id:manifest.name+'@1.0.0',version:'1.0.0',filename:'microweb-laravel-tiptap-editor-1.0.0.tgz',size:bytes.length,unpackedSize:[...expected.values()].reduce((s,b)=>s+b.length,0),entryCount:expected.size,integrity:'sha512-'+hash(bytes,'sha512','base64'),shasum:hash(bytes,'sha1'),files:[...expected].map(([path,b])=>({path,size:b.length}))};return {expected,bytes,pack:[p]};}
test('read regular ustar without extracting',()=>assert.equal(readArchive(one()).get('LICENSE').toString(),'license'));
test('reject oversized compressed input',()=>assert.throws(()=>readArchive(Buffer.alloc(MAX_ARCHIVE+1)),/size/));
test('reject oversized expanded input',()=>assert.throws(()=>readArchive(zlib.gzipSync(Buffer.alloc(MAX_TAR+512)))));
test('reject corrupt gzip',()=>assert.throws(()=>readArchive(Buffer.from('not gzip'))));
test('reject malformed TAR checksum',()=>{const b=basic();b[10]^=1;assert.throws(()=>readArchive(finish(b)),/checksum/);});
test('reject unsupported format',()=>assert.throws(()=>readArchive(finish(entry('package/a','a',h=>h.fill(0,257,265)))),/format/));
test('reject symbolic links',()=>assert.throws(()=>readArchive(finish(entry('package/a','a',h=>h[156]=50))),/regular/));
test('reject PAX entries',()=>assert.throws(()=>readArchive(finish(entry('package/a','a',h=>h[156]=120))),/regular/));
test('reject embedded link targets',()=>assert.throws(()=>readArchive(finish(entry('package/a','a',h=>h.write('target',157)))),/link target/));
test('reject traversal and absolute paths',()=>{for(const n of ['package/../a','/package/a','package/a/../../b','package//a','package/C:/a','package/a\\b','package/.'])assert.throws(()=>readArchive(finish(entry(n,'a'))),/path|root/);});
test('reject duplicate paths',()=>assert.throws(()=>readArchive(finish(basic(),basic())),/Duplicate/));
test('reject case collisions',()=>assert.throws(()=>readArchive(finish(basic(),entry('package/license','a'))),/case-colliding/));
test('reject empty file',()=>assert.throws(()=>readArchive(finish(entry('package/a',''))),/Empty/));
test('reject executable mode',()=>assert.throws(()=>readArchive(finish(entry('package/a','a',h=>h.write('0000755\0',100)))),/executable/));
test('reject invalid size octal',()=>assert.throws(()=>readArchive(finish(entry('package/a','a',h=>h.write('00000000009\0',124)))),/numeric/));
test('reject nonzero padding',()=>{const b=basic();b[b.length-1]=1;assert.throws(()=>readArchive(finish(b)),/padding/);});
test('reject missing end blocks',()=>assert.throws(()=>readArchive(zlib.gzipSync(basic())),/end marker/));
test('reject extra nonzero bytes after end',()=>assert.throws(()=>readArchive(zlib.gzipSync(Buffer.concat([basic(),Buffer.alloc(1024),basic()]))),/trailing/));
test('accept actual byte and metadata agreement',()=>{const f=fixture();assert.equal(verifyArchive(f.bytes,f.expected,f.pack).entries,5);});
test('reject stale bytes',()=>{const f=fixture();f.expected.set('dist/index.js',Buffer.from('old'));assert.throws(()=>verifyArchive(f.bytes,f.expected,f.pack),/bytes mismatch/);});
test('reject unlisted content',()=>{const f=fixture();f.expected.delete('README.md');assert.throws(()=>verifyArchive(f.bytes,f.expected,f.pack),/inventory/);});
test('reject fake archive digest',()=>{const f=fixture();f.pack[0].integrity='sha512-fake';assert.throws(()=>verifyArchive(f.bytes,f.expected,f.pack));});
test('reject fake entry count',()=>{const f=fixture();f.pack[0].entryCount++;assert.throws(()=>verifyArchive(f.bytes,f.expected,f.pack));});
test('reject fake metadata size',()=>{const f=fixture();f.pack[0].files[0].size++;assert.throws(()=>verifyArchive(f.bytes,f.expected,f.pack),/metadata size/);});
test('reject incorrect version metadata',()=>{const f=fixture();f.pack[0].version='0.0.0';assert.throws(()=>verifyArchive(f.bytes,f.expected,f.pack));});
test('reject unsafe archive filename',()=>{const f=fixture();f.pack[0].filename='../other.tgz';assert.throws(()=>verifyArchive(f.bytes,f.expected,f.pack));});
test('snapshot exact 39 distribution files',()=>{const r=fs.mkdtempSync(path.join(os.tmpdir(),'archive-test-'));try{fs.mkdirSync(path.join(r,'dist'));for(let i=0;i<39;i++)fs.writeFileSync(path.join(r,'dist',i+'.d.ts'),'x');for(const n of ['package.json','LICENSE','README.md'])fs.writeFileSync(path.join(r,n),'x');assert.equal(expectedFiles(r).size,42);fs.writeFileSync(path.join(r,'dist','extra'),'x');assert.throws(()=>expectedFiles(r),/39/);}finally{fs.rmSync(r,{recursive:true,force:true});}});
