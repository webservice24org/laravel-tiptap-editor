'use strict';
const NODE_RANGE = '^22.20.0 || ^24.12.0 || ^26.0.0';
const NPM_RANGE = '>=10.0.0';
function parseVersion(value) {
    const match = /^(?:v)?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(value || '');
    if (!match) throw new Error('Expected stable numeric version: ' + String(value));
    const nums = match.slice(1).map(Number);
    if (!nums.every(Number.isSafeInteger)) throw new Error('Invalid version number');
    return nums;
}
function validateRuntime(node, npm, expectedMajor) {
    const [major, minor] = parseVersion(node);
    if (!((major === 22 && minor >= 20) || (major === 24 && minor >= 12) || major === 26))
        throw new Error('Unsupported Node.js ' + node + '; expected ' + NODE_RANGE);
    if (parseVersion(npm)[0] < 10) throw new Error('Unsupported npm ' + npm + '; expected ' + NPM_RANGE);
    if (expectedMajor !== undefined && (!['22', '24', '26'].includes(expectedMajor) || Number(expectedMajor) !== major))
        throw new Error('Unexpected Node.js matrix major: ' + major + ' (expected ' + expectedMajor + ')');
    return { node, npm, major };
}
function main() {
    const args = process.argv.slice(2);
    if (args.length && (args.length !== 2 || args[0] !== '--expected-major')) throw new Error('Usage: npm run check:runtime [-- --expected-major 22|24|26]');
    const npm = /^npm\/([^\s]+)/.exec(process.env.npm_config_user_agent || '')?.[1];
    if (!npm) throw new Error('Run via npm run check:runtime (npm user agent missing).');
    const result = validateRuntime(process.versions.node, npm, args[1]);
    const manifest = require('../package.json');
    const lock = require('../package-lock.json');
    for (const engines of [manifest.engines, lock.packages?.['']?.engines]) {
        if (engines?.node !== NODE_RANGE || engines?.npm !== NPM_RANGE) throw new Error('Engine policy mismatch in manifest or root lock');
    }
    console.log('Runtime accepted: Node ' + result.node + ', npm ' + result.npm);
}
module.exports = { parseVersion, validateRuntime, NODE_RANGE, NPM_RANGE };
if (require.main === module) { try { main(); } catch (error) { console.error('STOP: ' + error.message); process.exitCode = 1; } }
