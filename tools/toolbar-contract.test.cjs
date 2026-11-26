'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {parse,inspectControls,inspectSource,inventory,verify,totals}=require('./toolbar-contract.cjs');
const root=path.resolve(__dirname,'..');
const expected=JSON.parse(fs.readFileSync(path.join(root,'tests/Toolbar/command-inventory.json'),'utf8'));
const parseFixture=s=>parse('fixture.tsx',s);
const controls=s=>inspectControls(parseFixture(s));
const actual=inventory(root);
const main='components/toolbar/EditorToolbar.tsx';
const dropdown='components/toolbar/FormatDropdown.tsx';
const table='components/toolbar/TableContextualToolbar.tsx';
const mutation=fn=>{const clone=structuredClone(actual);fn(clone);return clone;};
test('accepted source inventory matches review record',()=>verify(actual,expected));
test('inventory counts all three toolbar surfaces',()=>assert.deepEqual(totals(actual),{controls:50,options:4,command_chains:47,source_files:15}));
test('extract named button and exact handler',()=>{const [c]=controls('const a=<EditorButton tooltip="Bold" onClick={()=>editor.chain().focus().toggleBold().run()} />');assert.equal(c.label,'Bold');assert.match(c.handler,/toggleBold/);});
test('capture active and disabled expressions',()=>{const [c]=controls('const a=<EditorButton tooltip="Undo" active={false} disabled={!editor.can().undo()} onClick={undo}/>');assert.equal(c.active,'false');assert.equal(c.disabled,'!editor.can().undo()');});
test('capture nested rendering conditions',()=>{const [c]=controls('const a=mode === "visual" && (!inside && <button aria-label="Align" onClick={align}/>);');assert.deepEqual(c.conditions,['mode === "visual"','!inside']);});
test('capture dropdown options and selected value',()=>{const [c]=controls('const a=<select aria-label="Format" value={value} onChange={change}><option value="p">Paragraph</option><option value="h1">Heading 1</option></select>');assert.equal(c.value,'value');assert.deepEqual(c.options,[{value:'p',label:'Paragraph'},{value:'h1',label:'Heading 1'}]);});
test('capture color input label from enclosing control',()=>assert.equal(controls('const a=<label title="Cell color"><input type="color" onChange={change}/></label>')[0].label,'Cell color'));
test('capture native button text',()=>assert.equal(controls('const a=<button onClick={insert}><span>Insert</span></button>')[0].label,'Insert'));
test('reject duplicate control labels',()=>assert.throws(()=>controls('const a=<><button aria-label="X" onClick={a}/><button aria-label="X" onClick={b}/></>'),/Duplicate toolbar control/));
test('reject missing handlers',()=>assert.throws(()=>controls('const a=<button aria-label="X"/>'),/Missing handler/));
test('reject unlabelled controls',()=>assert.throws(()=>controls('const a=<button onClick={a}/>'),/Unlabelled/));
test('reject unreviewed spread props',()=>assert.throws(()=>controls('const a=<button aria-label="X" onClick={a} {...props}/>'),/Unreviewed spread/));
test('reject malformed TSX',()=>assert.throws(()=>parseFixture('const a=<button>'),/parse error/));
test('normalizes CRLF in expressions',()=>assert.deepEqual(inspectSource(parseFixture('const clearFormatting=()=>{\n editor.chain().focus().clearNodes().run()\n}')),inspectSource(parseFixture('const clearFormatting=()=>{\r\n editor.chain().focus().clearNodes().run()\r\n}'))));
test('detect handler drift',()=>assert.throws(()=>verify(mutation(x=>x.files[main].controls[6].handler='()=>{}'),expected),/Toolbar audit changed/));
test('detect active or availability drift',()=>assert.throws(()=>verify(mutation(x=>x.files[main].controls[6].active='false'),expected),/Toolbar audit changed/));
test('detect dropdown options drift',()=>assert.throws(()=>verify(mutation(x=>x.files[dropdown].controls[0].options.pop()),expected),/Toolbar audit changed/));
test('detect context command drift',()=>assert.throws(()=>verify(mutation(x=>x.files[table].chains.pop()),expected),/Toolbar audit changed/));
test('detect subscription drift',()=>assert.throws(()=>verify(mutation(x=>x.files[main].subscriptions=[]),expected),/Toolbar audit changed/));
test('detect dialog command drift',()=>assert.throws(()=>verify(mutation(x=>x.files['components/dialogs/LinkDialog.tsx'].chains=[]),expected),/Toolbar audit changed/));

// Reviewed F3B behavior must remain wired to the reactive selector and actual command.
for (const mark of ['bold','italic','underline','strike','subscript','superscript']) {
    test('inline formatting wiring: '+mark,()=>{
        const title=mark[0].toUpperCase()+mark.slice(1);
        const source=actual.files[main];
        const control=source.controls.find(c=>c.label===title);
        assert.equal(control.active,'formatting.'+mark);
        assert.equal(control.disabled,'!formatting.can'+title);
        assert.match(control.mouseDown,/preventDefault/);
        assert.match(control.handler,new RegExp('toggle'+title+'\\('));
        assert.ok(source.subscriptions.some(s=>s.includes("currentEditor.isActive('"+mark+"')")&&s.includes('currentEditor.can().toggle'+title+'()')));
    });
}
test('clear formatting retains block and mark commands with availability and selection guard',()=>{
    const source=actual.files[main];const c=source.controls.find(c=>c.label==='Clear Formatting');
    assert.equal(c.disabled,'!formatting.canClear');assert.match(c.mouseDown,/preventDefault/);
    assert.ok(source.subscriptions.some(s=>s.includes('currentEditor.can().chain().clearNodes().unsetAllMarks().run()')));
    assert.ok(source.helpers.some(h=>h.name==='clearFormatting'&&/clearNodes\(\)[\s\S]*unsetAllMarks\(\)/.test(h.expression)));
});
test('toggle button reports false and true; action buttons may omit pressed state',()=>{
    const button=actual.files['components/toolbar/EditorButton.tsx'];
    assert.ok(button.bindings.some(b=>b.expression.includes('aria-pressed={active}')));
    const code=fs.readFileSync(path.join(root,'resources/js/components/toolbar/EditorButton.tsx'),'utf8');
    assert.doesNotMatch(code,/active\s*=\s*false/);
});
test('script marks exclude one another in the shared extension factory',()=>{
    const source=actual.files['extensions/editorExtensions.ts'];const factory=source.helpers.find(h=>h.name==='createEditorExtensions').expression;
    assert.match(factory,/Subscript\.extend\(\{ excludes: 'superscript' \}\)/);
    assert.match(factory,/Superscript\.extend\(\{ excludes: 'subscript' \}\)/);
});
