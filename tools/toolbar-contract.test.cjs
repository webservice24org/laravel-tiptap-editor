'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
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
test('inventory counts all three toolbar surfaces',()=>assert.deepEqual(totals(actual),{controls:55,options:23,command_chains:46,source_files:15}));
test('extract named button and exact handler',()=>{const [c]=controls('const a=<EditorButton tooltip="Bold" onClick={()=>editor.chain().focus().toggleBold().run()} />');assert.equal(c.label,'Bold');assert.match(c.handler,/toggleBold/);});
test('capture active and disabled expressions',()=>{const [c]=controls('const a=<EditorButton tooltip="Undo" active={false} disabled={!editor.can().undo()} onClick={undo}/>');assert.equal(c.active,'false');assert.equal(c.disabled,'!editor.can().undo()');});
test('capture nested rendering conditions',()=>{const [c]=controls('const a=mode === "visual" && (!inside && <button aria-label="Align" onClick={align}/>);');assert.deepEqual(c.conditions,['mode === "visual"','!inside']);});
test('capture dropdown options and selected value',()=>{const [c]=controls('const a=<select aria-label="Format" value={value} onChange={change}><option value="p">Paragraph</option><option value="h1">Heading 1</option></select>');assert.equal(c.value,'value');assert.deepEqual(c.options,[{value:'p',label:'Paragraph',disabled:null},{value:'h1',label:'Heading 1',disabled:null}]);});
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
        if (mark === 'subscript' || mark === 'superscript') {
            assert.equal(control.handler,`()=> applyScript(editor, '${mark}')`.replace('()=>','() =>'));
            assert.ok(source.subscriptions.some(s=>s.includes("currentEditor.isActive('"+mark+"')")&&s.includes(`canToggleScript(currentEditor, '${mark}')`)));
        } else {
            assert.match(control.handler,new RegExp('toggle'+title+'\\('));
            assert.ok(source.subscriptions.some(s=>s.includes("currentEditor.isActive('"+mark+"')")&&s.includes('currentEditor.can().toggle'+title+'()')));
        }
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
    assert.match(factory,/Subscript\.extend\(\{\s*excludes: 'superscript',/);
    assert.match(factory,/Superscript\.extend\(\{\s*excludes: 'subscript',/);
});

// Execute the actual isolated toolbar helpers with an instrumented command-chain
// double. These tests verify orchestration, not Tiptap/ProseMirror internals.
function scriptFixture({editable=true,destroyed=false,allowed=true}={}) {
    const calls=[], transaction={kind:'scratch'};
    const chain=(kind)=>{
        const api={};
        for(const name of ['unsetSubscript','unsetSuperscript','toggleSubscript','toggleSuperscript','focus'])api[name]=()=>{calls.push(kind+':'+name);return api;};
        api.run=()=>{calls.push(kind+':run');return allowed;};return api;
    };
    const editor={isEditable:editable,isDestroyed:destroyed,state:{get tr(){calls.push('scratch:transaction');return transaction;}},chain(){calls.push('live:chain');return chain('live');}};
    class CommandManager {
        constructor(args){assert.equal(args.editor,editor);}
        createChain(tr){assert.equal(tr,transaction);calls.push('scratch:chain');return chain('scratch');}
    }
    const source=actual.files['extensions/editorExtensions.ts'].helpers.filter(h=>['scriptChain','canToggleScript','applyScript'].includes(h.name));
    assert.equal(source.length,3);
    const js=ts.transpileModule(source.map(h=>h.expression.replace(/^export /,'')).join('\n'),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
    const context=vm.createContext({CommandManager});vm.runInContext(js,context);
    return {calls,editor,can:mark=>context.canToggleScript(editor,mark),apply:mark=>context.applyScript(editor,mark)};
}
test('script capability probe removes opposite first and does not use live chain or focus',()=>{
    for(const [mark,unset,toggle] of [['subscript','unsetSuperscript','toggleSubscript'],['superscript','unsetSubscript','toggleSuperscript']]){
        const f=scriptFixture();assert.equal(f.can(mark),true);
        assert.deepEqual(f.calls,['scratch:transaction','scratch:chain','scratch:'+unset,'scratch:'+toggle,'scratch:run']);
    }
});
test('script action repeats the checked sequence in one live chain',()=>{
    for(const [mark,unset,toggle] of [['subscript','unsetSuperscript','toggleSubscript'],['superscript','unsetSubscript','toggleSuperscript']]){
        const f=scriptFixture();assert.equal(f.apply(mark),true);
        assert.deepEqual(f.calls,['scratch:transaction','scratch:chain','scratch:'+unset,'scratch:'+toggle,'scratch:run','live:chain','live:focus','live:'+unset,'live:'+toggle,'live:run']);
    }
});
test('denied script capability never starts live chain',()=>{
    const f=scriptFixture({allowed:false});assert.equal(f.apply('superscript'),false);assert.ok(!f.calls.some(c=>c.startsWith('live:')));
});
test('noneditable and destroyed editors do not probe or execute script actions',()=>{
    for(const opts of [{editable:false},{destroyed:true}]){const f=scriptFixture(opts);assert.equal(f.can('subscript'),false);assert.equal(f.apply('superscript'),false);assert.deepEqual(f.calls,[]);}
});

// F3C block formatting source contracts; actual runtime is exercised in Chromium.
test('format dropdown subscribes to selection and availability',()=>{
    const d=actual.files[dropdown];assert.ok(d.subscriptions.some(s=>s.includes('getCurrentFormat(currentEditor)')&&s.includes("canSetFormat(currentEditor, 'h3')")));
    assert.equal(d.controls[0].value,'format.value');assert.match(d.controls[0].disabled,/disabled/);
});
test('other or mixed block placeholder is not a selectable command',()=>{
    const d=actual.files[dropdown];assert.deepEqual(d.controls[0].options[0],{value:'other',label:'Other / mixed',disabled:'true'});
    assert.ok(d.helpers.some(h=>h.name==='getCurrentFormat'&&h.expression.includes("return 'other'")));
    assert.ok(d.helpers.some(h=>h.name==='handleChange'&&h.expression.includes('if (disabled) return')));
});
test('four supported block options have individual capability checks',()=>{
    const d=actual.files[dropdown];for(const o of d.controls[0].options.slice(1))assert.equal(o.disabled,'!format.'+o.value);
    assert.ok(d.helpers.some(h=>h.name==='canSetFormat'&&h.expression.includes('editor.can().setParagraph()')&&h.expression.includes('editor.can().setHeading({ level })')));
});
test('block action rechecks availability and executes focused chain',()=>{
    const h=actual.files[dropdown].helpers.find(h=>h.name==='applyBlockFormat').expression;
    assert.match(h,/if \(!canSetFormat\(editor, value\)\) return false/);assert.match(h,/focus\(\)\.setParagraph\(\)\.run\(\)/);assert.match(h,/focus\(\)\.setHeading/);
});
test('format dropdown is disabled in source mode',()=>assert.ok(actual.files[main].bindings.some(b=>b.kind==='FormatDropdown'&&b.expression.includes("disabled={mode !== 'visual'}"))));
for(const [label,cap,cmd] of [['Blockquote','canBlockquote','toggleBlockquote'],['Horizontal Rule','canHorizontalRule','setHorizontalRule']])test(label+' uses reactive availability and preserves mouse selection',()=>{
    const source=actual.files[main];const c=source.controls.find(c=>c.label===label);assert.equal(c.disabled,'!formatting.'+cap);assert.match(c.mouseDown,/preventDefault/);assert.ok(source.subscriptions.some(s=>s.includes('currentEditor.can().'+cmd+'()')));if(label==='Blockquote')assert.equal(c.active,'formatting.blockquote');
});
test('client sanitizer retains code and pre in the tag allowlist',()=>{
    const h=actual.files['utils/sanitizeHtml.ts'].helpers.find(h=>h.name==='ALLOWED_TAGS').expression;for(const tag of ['code','pre','blockquote','hr','h1','h2','h3'])assert.ok(h.includes("'"+tag+"'"));
});

for(const [label,cap,action,command] of [['Bullet List','canBulletList','bullet','toggleBulletList'],['Ordered List','canOrderedList','ordered','toggleOrderedList'],['Indent List Item','canIndentList','indent','sinkListItem'],['Outdent List Item','canOutdentList','outdent','liftListItem']])test(label+' uses guarded list capability and selection protection',()=>{
    const source=actual.files[main],c=source.controls.find(c=>c.label===label);
    assert.equal(c.disabled,'!formatting.'+cap);assert.match(c.mouseDown,/preventDefault/);assert.equal(c.handler,`() => applyListAction(editor, '${action}')`);
    assert.ok(source.subscriptions.some(s=>s.includes(`canListAction(currentEditor, '${action}')`)));
    assert.ok(source.helpers.find(h=>h.name==='canListAction').expression.includes(command+'('));assert.ok(source.helpers.find(h=>h.name==='applyListAction').expression.includes(command+'('));
    if(action==='bullet'||action==='ordered')assert.equal(c.active,'formatting.'+action+'List');else assert.equal(c.active,null);
});
for(const [label,cap,align] of [['Align Left','Left','left'],['Align Center','Center','center'],['Align Right','Right','right'],['Justify','Justify','justify']])test(label+' uses reactive state, guard and selection protection',()=>{
    const source=actual.files[main],c=source.controls.find(c=>c.label===label);
    assert.equal(c.active,'formatting.align'+cap);assert.equal(c.disabled,'!formatting.canAlign'+cap);assert.match(c.mouseDown,/preventDefault/);assert.equal(c.handler,`() => applyAlignment(editor, '${align}')`);
    assert.ok(c.conditions.includes('!isInsideTable'));assert.ok(source.subscriptions.some(s=>s.includes(`canAlignSelection(currentEditor, '${align}')`)));
});
test('list action rechecks editability and command capability before focus',()=>{
    const helpers=actual.files[main].helpers;assert.match(helpers.find(h=>h.name==='canListAction').expression,/!editor.isEditable \|\| editor.isDestroyed/);assert.match(helpers.find(h=>h.name==='applyListAction').expression,/if \(!canListAction\(editor, action\)\) return false/);
});
test('alignment capability limits supported text blocks and rejects atoms',()=>{
    const helpers=actual.files[main].helpers;const h=helpers.find(h=>h.name==='canAlignSelection').expression;assert.match(h,/editor.isActive\('table'\)/);assert.match(h,/name === 'paragraph' \|\| name === 'heading'/);assert.match(h,/!found \|\| unsupported/);assert.match(h,/node.isBlock && node.isAtom/);assert.match(h,/node.type.name === 'table'/);assert.match(helpers.find(h=>h.name==='applyAlignment').expression,/if \(!canAlignSelection\(editor, alignment\)\) return false/);
});
test('client allowlist includes ordered start and existing list nodes',()=>{
    const helpers=actual.files['utils/sanitizeHtml.ts'].helpers;assert.ok(helpers.find(h=>h.name==='ALLOWED_ATTR').expression.includes("'start'"));for(const tag of ['ol','ul','li'])assert.ok(helpers.find(h=>h.name==='ALLOWED_TAGS').expression.includes("'"+tag+"'"));
});

const sanitizerSource=fs.readFileSync(path.join(root,'resources/js/utils/sanitizeHtml.ts'),'utf8');
const sanitizerFile=parse('sanitizeHtml.ts',sanitizerSource);
const policyCode=sanitizerFile.statements.filter(n=>(ts.isFunctionDeclaration(n)&&['normalizeLinkUrl','isTextPreset'].includes(n.name?.text))||(ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>d.name.getText()==='TEXT_PRESETS'))).map(n=>n.getText()).join('\n');
const policies=vm.runInNewContext(ts.transpileModule(policyCode.replace(/export /g,''),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText+'\n({normalizeLinkUrl,isTextPreset})',{URL});
test('link policy accepts only supported persisted routes',()=>{for(const value of ['/articles/1','#heading','https://example.com/','http://example.com/'])assert.equal(policies.normalizeLinkUrl(value),value)});
test('bare hostname normalization is opt-in',()=>{assert.equal(policies.normalizeLinkUrl('example.com'),'');assert.equal(policies.normalizeLinkUrl('example.com',true),'https://example.com/');assert.equal(policies.normalizeLinkUrl('example.com/path',true),'https://example.com/path')});
test('link policy rejects unsafe and unsupported URLs',()=>{for(const value of ['//example.com','javascript:alert(1)','data:text/html,x','mailto:a@example.com','tel:123','ftp://example.com','https://user@example.com/','https://example.com\\x','https:///example.com','https://exa mple.com','https://example.com\n','https://example.com\u200b',''])assert.equal(policies.normalizeLinkUrl(value,true),'',value)});
test('typography values are finite presets',()=>{for(const [prop,value] of [['color','red'],['font-size','20px'],['font-family','serif']])assert.equal(policies.isTextPreset(prop,value),true);for(const [prop,value] of [['color','var(--x)'],['font-size','999px'],['font-family','RemoteFont']])assert.equal(policies.isTextPreset(prop,value),false)});
test('three preset dropdowns are reactive and guarded',()=>{const c=actual.files[main].controls;for(const label of ['Text color','Font size','Font family']){const control=c.find(x=>x.label===label);assert.equal(control.kind,'select');assert.match(control.disabled,/!formatting.can/);assert.match(control.handler,/applyPreset/);assert.ok(control.options.some(o=>o.value==='default'));assert.ok(control.options.some(o=>o.value===''&&o.disabled==='true'))}});
test('link action is reactive and preserves mouse selection',()=>{const controls=actual.files[main].controls;const link=controls.find(c=>c.label==='Insert or Edit Link');assert.equal(link.active,'formatting.link');assert.equal(link.disabled,'!formatting.canLink');assert.match(link.mouseDown,/preventDefault/);assert.match(link.handler,/canEditLink/)});
test('link dialog captures range and rejects changed document',()=>{const h=actual.files['components/dialogs/LinkDialog.tsx'].helpers;assert.match(h.find(x=>x.name==='captureLinkSelection').expression,/getMarkRange/);for(const name of ['handleInsert','handleRemove'])assert.match(h.find(x=>x.name===name).expression,/editor.state.doc !== snapshot.doc/)});
test('preset marks render only approved values',()=>{const h=actual.files['extensions/editorExtensions.ts'].helpers;assert.match(h.find(x=>x.name==='presetMark').expression,/isTextPreset\(property, value\)/);for(const mark of ['mwTextColor','mwFontSize','mwFontFamily'])assert.ok(h.find(x=>x.name==='createEditorExtensions').expression.includes(mark))});

function historyFixture({editable=true,destroyed=false,allowed=true}={}) {
    const calls=[];
    const chain={focus(){calls.push('focus');return this},undo(){calls.push('undo');return this},redo(){calls.push('redo');return this},run(){calls.push('run');return true}};
    const editor={isEditable:editable,isDestroyed:destroyed,can(){return {undo(){calls.push('canUndo');return allowed},redo(){calls.push('canRedo');return allowed}}},chain(){calls.push('chain');return chain}};
    const source=actual.files[main].helpers.filter(h=>['canHistoryAction','applyHistoryAction'].includes(h.name));assert.equal(source.length,2);
    const context=vm.createContext({});vm.runInContext(ts.transpileModule(source.map(h=>h.expression).join('\n'),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
    return {calls,apply:action=>context.applyHistoryAction(editor,action),can:action=>context.canHistoryAction(editor,action)};
}
test('history controls subscribe to native capability',()=>{for(const name of ['Undo','Redo']){const c=actual.files[main].controls.find(c=>c.label===name);assert.equal(c.disabled,'!formatting.can'+name);assert.match(c.handler,/applyHistoryAction/);assert.match(c.mouseDown,/preventDefault/);assert.ok(actual.files[main].subscriptions.some(s=>s.includes(`can${name}: canHistoryAction(currentEditor, '${name.toLowerCase()}')`)))}});
test('history capability does not dispatch or focus',()=>{const f=historyFixture();assert.equal(f.can('undo'),true);assert.equal(f.can('redo'),true);assert.deepEqual(f.calls,['canUndo','canRedo'])});
test('history action checks availability then executes once',()=>{for(const action of ['undo','redo']){const f=historyFixture();assert.equal(f.apply(action),true);assert.deepEqual(f.calls,[action==='undo'?'canUndo':'canRedo','chain','focus',action,'run'])}});
test('unavailable history action never executes',()=>{const f=historyFixture({allowed:false});assert.equal(f.apply('undo'),false);assert.equal(f.apply('redo'),false);assert.deepEqual(f.calls,['canUndo','canRedo'])});
test('read-only and destroyed editors never probe history',()=>{for(const opts of [{editable:false},{destroyed:true}]){const f=historyFixture(opts);assert.equal(f.apply('undo'),false);assert.equal(f.apply('redo'),false);assert.deepEqual(f.calls,[])}});
test('script shortcuts share guarded toolbar action and retain exclusions',()=>{const h=actual.files['extensions/editorExtensions.ts'].helpers.find(x=>x.name==='createEditorExtensions').expression;assert.match(h,/excludes: 'superscript',[\s\S]*?'Mod-,': \(\) => applyScript\(this.editor, 'subscript'\)/);assert.match(h,/excludes: 'subscript',[\s\S]*?'Mod-\.': \(\) => applyScript\(this.editor, 'superscript'\)/)});
