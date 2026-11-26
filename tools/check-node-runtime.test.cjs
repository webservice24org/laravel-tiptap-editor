'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const { validateRuntime, parseVersion } = require('./check-node-runtime.cjs');
for (const v of ['22.20.0','22.99.9','24.12.0','24.99.9','26.0.0','26.1.0']) {
    test('accepts Node '+v, () => assert.equal(validateRuntime(v,'10.0.0').node,v));
}
for (const v of ['18.20.0','20.19.0','21.9.0','22.19.9','23.9.0','24.11.9','25.9.0','27.0.0','28.0.0','26.0.0-rc.1']) {
    test('rejects Node '+v, () => assert.throws(() => validateRuntime(v,'11.13.0')));
}
test('rejects npm 9', () => assert.throws(() => validateRuntime('26.1.0','9.9.9')));
test('accepts npm 11', () => assert.equal(validateRuntime('26.1.0','11.13.0').npm,'11.13.0'));
test('rejects malformed npm', () => assert.throws(() => validateRuntime('26.1.0','11')));
test('rejects prerelease npm', () => assert.throws(() => validateRuntime('26.1.0','11.0.0-beta.1')));
test('accepts matching lane', () => assert.equal(validateRuntime('24.12.0','11.0.0','24').major,24));
test('rejects wrong lane', () => assert.throws(() => validateRuntime('24.12.0','11.0.0','22')));
test('rejects unknown lane', () => assert.throws(() => validateRuntime('24.12.0','11.0.0','24.x')));
test('rejects malformed versions', () => {for(const v of ['', '26.0', '026.0.0', '26.0.0+custom','999999999999999999.0.0']) assert.throws(() => parseVersion(v));});
const {cleanAudit} = require('./node-build-evidence.cjs');
const clean = () => ({auditReportVersion:2,vulnerabilities:{},metadata:{vulnerabilities:{info:0,low:0,moderate:0,high:0,critical:0,total:0}}});
test('accepts clean npm audit evidence', () => assert.doesNotThrow(() => cleanAudit(clean())));
test('rejects vulnerable package evidence', () => {const r=clean();r.vulnerabilities.example={severity:'low'};assert.throws(()=>cleanAudit(r));});
test('rejects nonzero totals and malformed audit evidence', () => {const r=clean();r.metadata.vulnerabilities.total=1;assert.throws(()=>cleanAudit(r));assert.throws(()=>cleanAudit({}));});
