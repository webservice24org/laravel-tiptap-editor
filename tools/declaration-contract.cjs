'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const ts = require('typescript');
const posix = path.posix;
const slash = p => p.split(path.sep).join('/');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const cssSource = '../../css/editor.css';
const cssOwner = 'components/TiptapEditor.d.ts';
const publicTypes = ['TiptapEditorProps','EditorExtensionOptions','EditorMode','ImageData','ImageUploadResult','NewsBlockData','NewsBlockStyle','NewsSearchHandler','NewsSearchResult','ImageAlignment','ImageFigureOptions','InsertNewsBlockOptions','VideoAlignment','VideoProvider'];
const publicValues = ['default','TiptapEditor','sanitizeEditorHtml','createEditorExtensions'];
function declarationFiles(dir, relative = '') {
    const files = [];
    for (const entry of fs.readdirSync(path.join(dir, relative), {withFileTypes:true})) {
        const name = posix.join(relative, entry.name);
        assert.ok(!entry.isSymbolicLink(), 'Symlink in declaration tree: '+name);
        if (entry.isDirectory()) files.push(...declarationFiles(dir, name));
        else if (name.endsWith('.d.ts')) files.push(name);
        else if (/\.d\.(?:ts|mts|cts)\.map$|\.d\.(?:mts|cts)$/.test(name)) throw Error('Unexpected declaration output: '+name+'; run a clean build.');
    }
    return files.sort();
}
function references(source) {
    const refs = [];
    function walk(node) {
        let literal;
        if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) literal=node.moduleSpecifier;
        else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) literal=node.argument.literal;
        else if (ts.isExternalModuleReference(node)) literal=node.expression;
        else if (ts.isModuleDeclaration(node) && ts.isStringLiteral(node.name)) literal=node.name;
        if (literal && ts.isStringLiteral(literal)) refs.push({node,literal});
        ts.forEachChild(node,walk);
    }
    walk(source);
    return refs;
}
function transform(name, text, files, external, normalize) {
    const source=ts.createSourceFile(name,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
    assert.equal(source.parseDiagnostics.length,0,'Malformed declaration: '+name);
    assert.equal(source.referencedFiles.length,0,'Unexpected triple-slash path reference: '+name);
    assert.equal(source.typeReferenceDirectives.length,0,'Unexpected triple-slash type reference: '+name);
    const edits=[];
    for (const {node,literal} of references(source)) {
        const spec=literal.text;
        if (name===cssOwner && spec===cssSource && ts.isImportDeclaration(node) && !node.importClause) {
            assert.ok(normalize,'Unnormalized source CSS import: '+name);
            edits.push({start:node.getStart(source),end:node.getEnd(),text:''});
            continue;
        }
        if (spec.startsWith('./')||spec.startsWith('../')) {
            assert.ok(!spec.includes('\\'),'Invalid module specifier: '+spec);
            const stem=spec.endsWith('.js')?spec.slice(0,-3):spec;
            const target=posix.normalize(posix.join(posix.dirname(name),stem+'.d.ts'));
            assert.ok(!target.startsWith('../') && files.has(target),'Unresolved relative declaration: '+name+' -> '+spec);
            const wanted=stem+'.js';
            if (spec!==wanted) {
                assert.ok(normalize,'Extensionless declaration: '+name+' -> '+spec);
                edits.push({start:literal.getStart(source),end:literal.getEnd(),text:JSON.stringify(wanted)});
            }
        } else {
            const packageName=spec.startsWith('@')?spec.split('/').slice(0,2).join('/'):spec.split('/')[0];
            assert.ok(external.has(packageName),'Undeclared external type dependency: '+name+' -> '+spec);
        }
    }
    for (const e of edits.sort((a,b)=>b.start-a.start)) text=text.slice(0,e.start)+e.text+text.slice(e.end);
    return text;
}
function expectedDeclarations(root) {
    const config=ts.readConfigFile(path.join(root,'tsconfig.build.json'),ts.sys.readFile);
    assert.ok(!config.error,'Unable to read build config');
    const parsed=ts.parseJsonConfigFileContent(config.config,ts.sys,root);
    assert.equal(parsed.errors.length,0,'Invalid build config');
    const base=path.join(root,'resources/js');
    const expected=parsed.fileNames.filter(f=>/\.tsx?$/.test(f)&&!f.endsWith('.d.ts')).map(f=>slash(path.relative(base,f)).replace(/\.tsx?$/,'.d.ts')).sort();
    assert.ok(expected.includes('index.d.ts')&&!expected.some(f=>f==='Index.d.ts'||f.startsWith('../')),'Incorrect declaration input set');
    assert.equal(new Set(expected.map(x=>x.toLowerCase())).size,expected.length,'Case-colliding declaration outputs');
    return expected;
}
function verifyEntry(text) {
    const source=ts.createSourceFile('index.d.ts',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
    const values=[],types=[];
    for(const statement of source.statements){
        assert.ok(ts.isExportDeclaration(statement)&&statement.exportClause&&ts.isNamedExports(statement.exportClause),'Unexpected public declaration entry shape');
        for(const element of statement.exportClause.elements) (statement.isTypeOnly||element.isTypeOnly?types:values).push(element.name.text);
    }
    assert.deepEqual(values.sort(),[...publicValues].sort(),'Unexpected public value exports');
    assert.deepEqual(types.sort(),[...publicTypes].sort(),'Unexpected public type exports');
}
function main() {
    const [mode, report, ...extra]=process.argv.slice(2);
    assert.ok(['normalize','verify'].includes(mode)&&!extra.length&&!(mode==='normalize'&&report),'Usage: node tools/declaration-contract.cjs normalize|verify [report.json]');
    const root=path.resolve(__dirname,'..'), dist=path.join(root,'dist');
    const manifest=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
    assert.equal(manifest.types,'./dist/index.d.ts');
    assert.equal(manifest.exports['.'].types,manifest.types);
    assert.equal(manifest.exports['./editor.css'],'./dist/editor.css');
    const external=new Set([...Object.keys(manifest.dependencies),...Object.keys(manifest.peerDependencies)]);
    const names=declarationFiles(dist);
    assert.deepEqual(names,expectedDeclarations(root),'Declaration output inventory mismatch; run npm run build.');
    const set=new Set(names), normalized=new Map();
    for(const name of names){
        const input=fs.readFileSync(path.join(dist,name),'utf8');
        const output=transform(name,input,set,external,mode==='normalize');
        transform(name,output,set,external,false);
        normalized.set(name,output);
    }
    verifyEntry(normalized.get('index.d.ts'));
    // Validate everything before writing anything. This operation only edits generated declarations.
    if(mode==='normalize') for(const [name,text] of normalized) fs.writeFileSync(path.join(dist,name),text);
    if(report){
        const files=names.map(name=>({path:'dist/'+name,bytes:fs.statSync(path.join(dist,name)).size,sha256:hash(fs.readFileSync(path.join(dist,name)))}));
        fs.writeFileSync(report,JSON.stringify({status:'passed',typescript:ts.version,declarations:names.length,public_values:publicValues,public_types:publicTypes,files},null,2)+'\n',{flag:'wx'});
    }
    console.log('Declaration contract '+(mode==='normalize'?'normalized':'verified')+': '+names.length+' files, '+publicValues.length+' values, '+publicTypes.length+' types.');
}
module.exports={transform,verifyEntry,expectedDeclarations,declarationFiles};
if(require.main===module){try{main();}catch(e){console.error('STOP: '+e.message);process.exitCode=1;}}
