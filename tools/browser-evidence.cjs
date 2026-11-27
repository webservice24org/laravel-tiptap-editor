'use strict';
const assert=require('node:assert/strict');
// Independently reviewed, ordered acceptance inventory; never derive from a reported result.
const EXPECTED=Object.freeze({
    smoke:Object.freeze(['named mount','React version','CSS applied','minHeight','edit callback','unmount','default remount','sanitizer and extension factory','no page errors or remote requests']),
    formatting:Object.freeze(["Bold: selection apply/remove", "Bold: stored mark typing", "Bold: selection-only state", "Italic: selection apply/remove", "Italic: stored mark typing", "Italic: selection-only state", "Underline: selection apply/remove", "Underline: stored mark typing", "Underline: selection-only state", "Strike: selection apply/remove", "Strike: stored mark typing", "Strike: selection-only state", "Subscript: selection apply/remove", "Subscript: stored mark typing", "Subscript: selection-only state", "Superscript: selection apply/remove", "Superscript: stored mark typing", "Superscript: selection-only state", "combined marks and clear formatting", "mixed selection bold", "subscript/superscript exclusion", "safe inline HTML round trip"]),
    blocks:Object.freeze(['heading 1 round trip','heading 2 round trip','heading 3 round trip','selection-only block state','mixed block selection','blockquote toggle','horizontal rule','clear block formatting','safe code markup round trip','source mode format guard']),
    lists:Object.freeze(["bullet list round trip", "ordered list round trip", "list type switching", "bullet indentation and outdent", "ordered indentation and outdent", "list indentation boundaries", "list keyboard nesting", "selection-only list state", "paragraph alignment", "heading and mixed alignment", "selection-only alignment state", "unsupported alignment context", "ordered start round trip", "invalid ordered start attributes"]),
    linksTypography:Object.freeze(['selected link insertion and editing','cursor link insertion','link removal and cancel','unsafe link rejection','relative and fragment links','host change rejects stale link selection','automatic bare host link','text color round trip','font size round trip','font family round trip','combined typography and clear','selection-only typography state','unsafe typography sanitization']),
    history:Object.freeze(['initial history boundaries','toolbar undo and redo typing','keyboard undo and both redo shortcuts','new edit invalidates redo','undo and redo inline formatting','undo and redo block formatting','undo and redo list conversion','keyboard bold italic underline strike','keyboard script mark switching','keyboard heading and paragraph','selection-only history stability','history shortcuts outside editor']),
    synchronization:Object.freeze(["table context transitions", "cell selection attributes", "split availability on equal-style cells", "cell alignment and undo synchronization", "independent editor state and history"]),
});
const TOTAL=Object.values(EXPECTED).reduce((n,checks)=>n+checks.length,0);
function verifySuite(name,result){
    assert.ok(Object.hasOwn(EXPECTED,name),'Unknown browser suite: '+name);
    assert.equal(result?.status,'passed','Browser suite did not pass: '+name);
    assert.deepEqual(result.checks,EXPECTED[name],'Incomplete or reordered browser evidence: '+name);
    return result.checks.length;
}
function verifyBrowserEvidence(report,react){
    assert.match(react,/^(18|19)\.\d+\.\d+$/);
    assert.equal(report?.schema,1,'Browser evidence schema');
    assert.equal(report.status,'passed','Browser regression did not pass');
    assert.equal(report.react,react,'React version mismatch');
    assert.match(report.chromium,/^\d+\.\d+\.\d+\.\d+$/,'Chromium version missing');
    assert.deepEqual(report.errors,[],'Browser errors');
    assert.deepEqual(report.unexpected,[],'Unexpected network requests');
    assert.ok(Array.isArray(report.warnings)&&report.warnings.every(x=>typeof x==='string'),'Invalid warning report');
    let count=verifySuite('smoke',{status:'passed',checks:report.checks});
    for(const name of Object.keys(EXPECTED).slice(1))count+=verifySuite(name,report[name]);
    assert.equal(count,TOTAL);assert.equal(report.totalChecks,TOTAL,'Browser count mismatch');
    assert.deepEqual(Object.keys(report.timingsMs),Object.keys(EXPECTED),'Missing or reordered suite timings');
    for(const ms of Object.values(report.timingsMs))assert.ok(Number.isFinite(ms)&&ms>=0,'Invalid suite duration');
    return count;
}
function stageCategory(stage){
    if(['chromium-dependencies','chromium-install'].includes(stage))return 'browser-provisioning';
    if(stage==='browser')return 'browser-execution';
    if(stage==='browser-evidence')return 'evidence-validation';
    return 'consumer-preflight-or-build';
}
module.exports={EXPECTED,TOTAL,verifySuite,verifyBrowserEvidence,stageCategory};
