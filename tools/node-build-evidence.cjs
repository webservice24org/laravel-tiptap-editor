'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { validateRuntime } = require('./check-node-runtime.cjs');
const readJson = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function cleanAudit(report) {
    assert.equal(report.auditReportVersion, 2, 'Unexpected npm audit format');
    assert.ok(report.vulnerabilities && !Array.isArray(report.vulnerabilities) && typeof report.vulnerabilities === 'object');
    assert.equal(Object.keys(report.vulnerabilities).length, 0, 'Audit reported vulnerable packages');
    for (const key of ['info','low','moderate','high','critical','total']) assert.equal(report.metadata?.vulnerabilities?.[key],0,'Audit count: '+key);
}
function main() {
    const [dir, npm, major, ...rest] = process.argv.slice(2);
    assert.ok(dir && npm && major && !rest.length, 'Usage: node tools/node-build-evidence.cjs <report-dir> <npm-version> <expected-major>');
    const runtime = validateRuntime(process.versions.node, npm, major);
    const lock = readJson('package-lock.json');
    const manifest = readJson('package.json');
    for (const field of ['engines','dependencies','devDependencies','peerDependencies']) assert.deepEqual(lock.packages[''][field],manifest[field]);
    for (const name of ['audit-all.json','audit-runtime.json']) cleanAudit(readJson(path.join(dir,name)));
    const outputs = {};
    for (const file of ['dist/index.js','dist/index.js.map','dist/index.d.ts','dist/editor.css']) {
        const st = fs.statSync(file); assert.ok(st.isFile() && st.size > 0,'Missing or empty build output: '+file);
        outputs[file] = {bytes:st.size, sha256:sha(file)};
    }
    const installed = {};
    for (const name of ['dompurify','@tiptap/core','@tiptap/pm','@tiptap/react','react','react-dom','vite','typescript','rimraf']) {
        const version = readJson(path.join('node_modules',name,'package.json')).version;
        assert.equal(version,lock.packages['node_modules/'+name].version,'Installed version mismatch: '+name);
        installed[name]=version;
    }
    const summary = {status:'passed',...runtime,platform:process.platform,arch:process.arch,commit:process.env.GITHUB_SHA || null,manifest_sha256:sha('package.json'),lock_sha256:sha('package-lock.json'),installed,outputs,audits:'clean'};
    fs.writeFileSync(path.join(dir,'build-summary.json'),JSON.stringify(summary,null,2)+'\n',{flag:'wx'});
    console.log('Build evidence verified.');
}
module.exports = {cleanAudit};
if (require.main === module) {try {main();} catch(e){console.error('STOP: '+e.message);process.exitCode=1;}}
