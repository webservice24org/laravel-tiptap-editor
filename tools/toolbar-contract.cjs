'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const prefix = 'resources/js/';
const toolbarFiles = ['EditorToolbar', 'FormatDropdown', 'TableContextualToolbar', 'EditorButton', 'ToolbarGroup'].map(n => `components/toolbar/${n}.tsx`);
const dialogFiles = ['LinkDialog','ImageDialog','VideoDialog','TableDialog','NewsBlockDialog','TablePropertiesDialog','Dialog'].map(n => `components/dialogs/${n}.tsx`);
const sources = [...toolbarFiles,...dialogFiles,'components/TiptapEditor.tsx','extensions/editorExtensions.ts','utils/sanitizeHtml.ts'];
function parse(name,text) {
    const file=ts.createSourceFile(name,text,ts.ScriptTarget.Latest,true,name.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
    assert.equal(file.parseDiagnostics.length,0,`TypeScript parse error: ${name}`);
    return file;
}
function walk(node,fn){fn(node);ts.forEachChild(node,n=>walk(n,fn));}
function printed(n,file){return n?n.getText(file).replace(/\r\n/g,'\n').trim():null;}
function tag(n){return ts.isJsxElement(n)?n.openingElement.tagName.getText():ts.isJsxSelfClosingElement(n)?n.tagName.getText():null;}
function attr(n,name,file){const open=ts.isJsxElement(n)?n.openingElement:n;const matches=open.attributes.properties.filter(a=>ts.isJsxAttribute(a)&&a.name.getText()===name);assert.ok(matches.length<=1,`Duplicate JSX attribute ${name}`);const a=matches[0];if(!a)return null;if(!a.initializer)return 'true';if(ts.isStringLiteral(a.initializer))return a.initializer.text;return printed(a.initializer.expression,file);}
function textContent(n){return ts.isJsxElement(n)?n.children.filter(ts.isJsxText).map(x=>x.getText().trim()).filter(Boolean).join(' '):'';}
function childrenOf(n,wanted){const result=[];walk(n,x=>{if(x!==n&&tag(x)===wanted)result.push(x);});return result;}
function ancestors(n,fn){for(let p=n.parent;p;p=p.parent)fn(p);}
function conditions(n,file){const result=[];let child=n;for(let p=n.parent;p;child=p,p=p.parent){if(ts.isBinaryExpression(p)&&p.operatorToken.kind===ts.SyntaxKind.AmpersandAmpersandToken&&child===p.right)result.push(printed(p.left,file));if(ts.isConditionalExpression(p)&&(child===p.whenTrue||child===p.whenFalse))result.push((child===p.whenFalse?'NOT ':'')+printed(p.condition,file));}return result.reverse();}
function inspectControls(file){
    const items=[];const seen=new Set();
    walk(file,n=>{
        const kind=tag(n);if(!['button','EditorButton','select','input'].includes(kind))return;
        const get=k=>attr(n,k,file);
        let label=get('aria-label')||get('tooltip')||get('title')||childrenOf(n,'span').map(textContent).filter(Boolean).join(' ')||textContent(n);
        if(kind==='input'&&!label)ancestors(n,p=>{if(!label&&tag(p)==='label')label=attr(p,'title',file)||childrenOf(p,'span').map(textContent).filter(Boolean).join(' ');});
        assert.ok(label,`Unlabelled toolbar control in ${file.fileName}`);
        assert.ok(!seen.has(label),`Duplicate toolbar control: ${label}`);seen.add(label);
        const handler=get(kind==='select'||kind==='input'?'onChange':'onClick');assert.ok(handler,`Missing handler: ${label}`);
        const options=kind==='select'?childrenOf(n,'option').map(o=>({value:attr(o,'value',file),label:textContent(o),disabled:attr(o,'disabled',file)})):[];
        const open=ts.isJsxElement(n)?n.openingElement:n;
        assert.ok(!open.attributes.properties.some(ts.isJsxSpreadAttribute),`Unreviewed spread: ${label}`);
        items.push({label,kind,handler,active:get('active'),disabled:get('disabled'),pressed:get('aria-pressed'),mouseDown:get('onMouseDown'),className:get('className'),value:get('value'),conditions:conditions(n,file),options});
    });return items;
}
function callName(n){return ts.isCallExpression(n)?(ts.isPropertyAccessExpression(n.expression)?n.expression.name.text:ts.isIdentifier(n.expression)?n.expression.text:null):null;}
function inspectSource(file){
    const chains=[],subscriptions=[],helpers=[],directCommands=[],bindings=[],effects=[];
    walk(file,n=>{
        const name=callName(n);
        const kind=tag(n);
        if(['EditorToolbar','FormatDropdown','TableContextualToolbar','EditorContent','CodeEditor','LinkDialog','ImageDialog','VideoDialog','TableDialog','NewsBlockDialog','TablePropertiesDialog'].includes(kind))bindings.push({kind,expression:printed(n,file),conditions:conditions(n,file)});
        if(kind==='button'&&file.fileName.endsWith('/EditorButton.tsx'))bindings.push({kind,expression:printed(n,file),conditions:conditions(n,file)});
        if(name==='useEffect')effects.push(printed(n,file));
        if(name==='run'&&ts.isPropertyAccessExpression(n.expression))chains.push(printed(n,file));
        if(['useEditorState','useEditor'].includes(name))subscriptions.push(printed(n,file));
        if(name&&ts.isPropertyAccessExpression(n.expression)&&ts.isPropertyAccessExpression(n.expression.expression)&&n.expression.expression.name.text==='commands')directCommands.push(printed(n,file));
        if(ts.isVariableDeclaration(n)&&ts.isIdentifier(n.name)&&['clearFormatting','handleChange','getCurrentFormat','updateCurrentTableCell','handleInsert','handleRemove','switchMode'].includes(n.name.text)&&n.initializer)helpers.push({name:n.name.text,expression:printed(n.initializer,file)});
        if(ts.isFunctionDeclaration(n)&&n.name&&['createEditorExtensions','scriptChain','canToggleScript','applyScript','getCurrentFormat','canSetFormat','applyBlockFormat','canListAction','applyListAction','canAlignSelection','applyAlignment','canEditLink','captureLinkSelection','normalizeLinkUrl','isTextPreset','presetMark','canSetPreset','presetValue','applyPreset','canHistoryAction','applyHistoryAction','guardUnfocusedHistory'].includes(n.name.text))helpers.push({name:n.name.text,expression:printed(n,file)});
        if(ts.isVariableDeclaration(n)&&ts.isIdentifier(n.name)&&['ALLOWED_TAGS','ALLOWED_ATTR','TEXT_PRESETS'].includes(n.name.text)&&n.initializer)helpers.push({name:n.name.text,expression:printed(n.initializer,file)});
    });return {chains,subscriptions,helpers,directCommands,bindings,effects};
}
function inventory(project=root){
    const files={};
    for(const name of sources){const file=parse(name,fs.readFileSync(path.join(project,prefix,name),'utf8'));files[name]=inspectSource(file);if(toolbarFiles.slice(0,3).includes(name))files[name].controls=inspectControls(file);}
    return {schema_version:1,files};
}
function verify(actual,expected){assert.equal(actual.schema_version,expected.schema_version);assert.deepEqual(Object.keys(actual.files),Object.keys(expected.files),'Source scope changed');for(const name of Object.keys(expected.files))assert.deepEqual(actual.files[name],expected.files[name],`Toolbar audit changed: ${name}; review the inventory before updating it.`);return actual;}
function totals(report){const controls=Object.values(report.files).flatMap(f=>f.controls||[]);return {controls:controls.length,options:controls.reduce((n,c)=>n+c.options.length,0),command_chains:Object.values(report.files).reduce((n,f)=>n+f.chains.length,0),source_files:Object.keys(report.files).length};}
module.exports={parse,inspectControls,inspectSource,inventory,verify,totals};
if(require.main===module){try{const args=process.argv.slice(2);assert.ok(args.length<=1,'Usage: node tools/toolbar-contract.cjs [report.json]');const expected=JSON.parse(fs.readFileSync(path.join(root,'tests/Toolbar/command-inventory.json'),'utf8'));const actual=verify(inventory(),expected);const report={status:'passed',...totals(actual),...actual};if(args[0])fs.writeFileSync(args[0],JSON.stringify(report,null,2)+'\n');console.log(`Toolbar audit verified: ${report.controls} controls, ${report.options} format options, ${report.command_chains} command chains, ${report.source_files} source files.`);}catch(e){console.error('STOP: '+e.message);process.exitCode=1;}}
