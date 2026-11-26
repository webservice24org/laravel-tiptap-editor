import assert from 'node:assert/strict'
import { selectBlocks } from './blocks.mjs'

export const expectedListChecks = ["bullet list round trip", "ordered list round trip", "list type switching", "bullet indentation and outdent", "ordered indentation and outdent", "list indentation boundaries", "list keyboard nesting", "selection-only list state", "paragraph alignment", "heading and mixed alignment", "selection-only alignment state", "unsupported alignment context", "ordered start round trip", "invalid ordered start attributes"]

// Compare actual hierarchy, text, marks, alignment and ordered-list starts in
// both live and saved HTML. Only one exact empty trailing paragraph is optional.
export function listDocumentMatches({html, trailing}) {
    const ed=document.querySelector('.mw-tiptap-content[contenteditable="true"]')
    const savedHtml=document.querySelector('#html')?.textContent
    if (!ed || typeof savedHtml!=='string' || Number(document.querySelector('#changes')?.textContent)<=0) return false
    const parse=s=>new DOMParser().parseFromString(s,'text/html').body
    function emptyTail(p) {
        if(p?.tagName!=='P'||p.attributes.length!==0||p.textContent!=='')return false
        if(p.childNodes.length===0)return true
        const b=p.firstChild
        return p.childNodes.length===1&&b.nodeName==='BR'&&b.attributes.length===1&&b.getAttribute('class')==='ProseMirror-trailingBreak'
    }
    function signature(node) {
        if(node.nodeType===Node.TEXT_NODE)return ['text',node.nodeValue]
        if(node.nodeType!==Node.ELEMENT_NODE)return ['unexpected',node.nodeType]
        return [node.tagName.toLowerCase(),node.style?.textAlign??'',node.getAttribute('start'),children(node)]
    }
    // Adjacent DOM text nodes may be split by editing; compare their exact
    // concatenation without trimming, collapsing or deleting whitespace.
    function children(root) {
        const result=[]
        for(const n of root.childNodes){
            const item=signature(n),previous=result.at(-1)
            if(item[0]==='text'&&previous?.[0]==='text')previous[1]+=item[1]
            else result.push(item)
        }
        return result
    }
    const expected=[...parse(html).childNodes].map(signature)
    return [ed,parse(savedHtml)].every(root=>{
        const nodes=[...root.childNodes]
        if(trailing&&nodes.length===expected.length+1&&emptyTail(nodes.at(-1)))nodes.pop()
        return JSON.stringify(nodes.map(signature))===JSON.stringify(expected)
    })
}

export async function runLists(page,editor) {
    const checks=[]
    const toolbar=page.getByRole('toolbar',{name:'Text formatting controls'})
    const button=name=>toolbar.getByRole('button',{name,exact:true})
    async function reset(html,text) {
        const before=Number(await page.locator('#format-generation').textContent())
        await page.locator('#format-source').fill(html);await page.locator('#format-reset').click()
        await page.waitForFunction(({before,text})=>Number(document.querySelector('#format-generation')?.textContent)===before+1&&document.querySelector('.mw-tiptap-content[contenteditable="true"]')?.textContent===text&&document.querySelector('#changes')?.textContent==='0',{before,text})
        await editor.waitFor({state:'visible'})
    }
    async function pressed(name,value) {
        await page.waitForFunction(({name,value})=>[...document.querySelectorAll('button[aria-label]')].find(b=>b.getAttribute('aria-label')===name)?.getAttribute('aria-pressed')===String(value),{name,value})
    }
    async function enabled(name,value) {
        await page.waitForFunction(({name,value})=>{const b=[...document.querySelectorAll('button[aria-label]')].find(b=>b.getAttribute('aria-label')===name);return !!b&&b.disabled===!value},{name,value})
    }
    async function click(name) {await enabled(name,true);await button(name).click()}
    async function shape(html,trailing=false) {await page.waitForFunction(listDocumentMatches,{html,trailing})}
    async function unchanged(source,initial) {
        assert.equal(await page.locator('#changes').textContent(),'0')
        assert.equal(await page.locator('#html').textContent(),source)
        assert.equal(await editor.innerHTML(),initial)
    }
    async function check(name,fn) {
        try {await fn();checks.push(name);console.log('List formatting passed: '+name)}
        catch(e) {
            try {console.error('List diagnostics: '+JSON.stringify(await page.evaluate(()=>({html:document.querySelector('.mw-tiptap-content')?.innerHTML,saved:document.querySelector('#html')?.textContent,changes:document.querySelector('#changes')?.textContent,selection:{text:getSelection()?.toString(),anchor:getSelection()?.anchorNode?.parentElement?.outerHTML,anchorOffset:getSelection()?.anchorOffset,focus:getSelection()?.focusNode?.parentElement?.outerHTML,focusOffset:getSelection()?.focusOffset},focused:document.activeElement?.outerHTML.slice(0,250),buttons:[...document.querySelectorAll('.mw-tiptap-toolbar button')].map(b=>({label:b.getAttribute('aria-label'),pressed:b.getAttribute('aria-pressed'),disabled:b.disabled}))}))))}catch{}
            throw Error('List formatting failed: '+name+' — '+e.message,{cause:e})
        }
    }
    for(const [tag,name,label] of [['ul','bullet list round trip','Bullet List'],['ol','ordered list round trip','Ordered List']])await check(name,async()=>{
        await reset('<p><strong>Item</strong></p>','Item');await selectBlocks(editor,'p');await pressed(label,false)
        await click(label);await shape(`<${tag}><li><p><strong>Item</strong></p></li></${tag}>`,true);await pressed(label,true)
        await selectBlocks(editor,`${tag} li p`);await click(label);await shape('<p><strong>Item</strong></p>',true);await pressed(label,false)
    })
    await check('list type switching',async()=>{
        await reset('<ul><li><p>One</p></li><li><p>Two</p></li></ul><p></p>','OneTwo')
        await selectBlocks(editor,'ul > li:first-child > p');await click('Ordered List');await shape('<ol><li><p>One</p></li><li><p>Two</p></li></ol>',true);await pressed('Ordered List',true);await pressed('Bullet List',false)
        await selectBlocks(editor,'ol > li:first-child > p');await click('Bullet List');await shape('<ul><li><p>One</p></li><li><p>Two</p></li></ul>',true);await pressed('Bullet List',true)
    })
    for(const [tag,name] of [['ul','bullet indentation and outdent'],['ol','ordered indentation and outdent']])await check(name,async()=>{
        const flat=`<${tag}><li><p>First</p></li><li><p><strong>Second</strong></p></li></${tag}>`
        await reset(flat+'<p></p>','FirstSecond');await selectBlocks(editor,`${tag} > li:nth-child(2) > p`,`${tag} > li:nth-child(2) > p`,true)
        await click('Indent List Item');await shape(`<${tag}><li><p>First</p><${tag}><li><p><strong>Second</strong></p></li></${tag}></li></${tag}>`,true)
        await selectBlocks(editor,`${tag} ${tag} > li > p`);await click('Outdent List Item');await shape(flat,true)
    })
    await check('list indentation boundaries',async()=>{
        await reset('<p>Plain</p>','Plain');await selectBlocks(editor,'p');await enabled('Indent List Item',false);await enabled('Outdent List Item',false)
        await reset('<ul><li><p>Only</p></li></ul><p></p>','Only');await selectBlocks(editor,'ul li p');await enabled('Indent List Item',false);await click('Outdent List Item');await shape('<p>Only</p>',true)
    })
    await check('list keyboard nesting',async()=>{
        const flat='<ul><li><p>First</p></li><li><p>Second</p></li></ul>'
        await reset(flat+'<p></p>','FirstSecond');await selectBlocks(editor,'ul > li:nth-child(2) > p');await page.keyboard.press('Tab');await shape('<ul><li><p>First</p><ul><li><p>Second</p></li></ul></li></ul>',true)
        await selectBlocks(editor,'ul ul li p');await page.keyboard.press('Shift+Tab');await shape(flat,true)
    })
    await check('selection-only list state',async()=>{
        const source='<p>Plain</p><ul><li><p>Bullet</p></li></ul><ol><li><p>Number</p></li></ol><p></p>'
        await reset(source,'PlainBulletNumber');const initial=await editor.innerHTML()
        for(const [selector,b,o] of [['p:first-child',false,false],['ul li p',true,false],['ol li p',false,true],['p:first-child',false,false]]){
            await selectBlocks(editor,selector);await pressed('Bullet List',b);await pressed('Ordered List',o);await unchanged(source,initial)
        }
    })
    const alignments=[['left','Align Left'],['center','Align Center'],['right','Align Right'],['justify','Justify']]
    await check('paragraph alignment',async()=>{
        await reset('<p><strong>Aligned</strong></p>','Aligned');await selectBlocks(editor,'p')
        for(const [align,label] of alignments){await click(label);await shape(`<p style="text-align: ${align}"><strong>Aligned</strong></p>`);await pressed(label,true);for(const [,other] of alignments)if(other!==label)await pressed(other,false)}
    })
    await check('heading and mixed alignment',async()=>{
        await reset('<h2>Heading</h2><p>Paragraph</p>','HeadingParagraph');await selectBlocks(editor,'h2');await click('Align Center');await shape('<h2 style="text-align: center">Heading</h2><p>Paragraph</p>')
        await selectBlocks(editor,'h2','p',true);await click('Align Right');await shape('<h2 style="text-align: right">Heading</h2><p style="text-align: right">Paragraph</p>');await pressed('Align Right',true)
    })
    await check('selection-only alignment state',async()=>{
        const source='<p style="text-align: left">Left</p><h2 style="text-align: center">Center</h2><p style="text-align: right">Right</p><p style="text-align: justify">Justify</p><p>Plain</p>'
        await reset(source,'LeftCenterRightJustifyPlain');const initial=await editor.innerHTML()
        for(const [selector,selected] of [['p:nth-child(1)','Align Left'],['h2','Align Center'],['p:nth-child(3)','Align Right'],['p:nth-child(4)','Justify'],['p:nth-child(5)',null]]){
            await selectBlocks(editor,selector);for(const [,label] of alignments)await pressed(label,label===selected);await unchanged(source,initial)
        }
    })
    await check('unsupported alignment context',async()=>{
        await reset('<pre><code>Code</code></pre><p>Plain</p>','CodePlain');const initial=await editor.innerHTML();await selectBlocks(editor,'pre code');for(const [,label] of alignments)await enabled(label,false)
        await selectBlocks(editor,'pre code','p',true);for(const [,label] of alignments)await enabled(label,false)
        await selectBlocks(editor,'p');for(const [,label] of alignments)await enabled(label,true)
        await unchanged('<pre><code>Code</code></pre><p>Plain</p>',initial)
    })
    await check('ordered start round trip',async()=>{
        await reset('<ol start="7"><li><p>Seven</p></li></ol><p></p>','Seven');await selectBlocks(editor,'ol li p');await page.keyboard.insertText('Z');await shape('<ol start="7"><li><p>SZeven</p></li></ol>',true)
        await page.locator('#hide').click();await editor.waitFor({state:'detached'});await page.locator('#show-default').click();await editor.waitFor({state:'visible'});assert.equal(await editor.locator('ol').getAttribute('start'),'7');assert.equal(await editor.locator('ol li p').textContent(),'SZeven')
    })
    await check('invalid ordered start attributes',async()=>{
        // Invalid values are removed at the sanitizer boundary, not silently
        // converted to another starting number. Unapproved start on P is removed.
        await reset('<ol start="0"><li><p>One</p></li></ol><p start="7">Tail</p>','OneTail');await selectBlocks(editor,'ol li p');await page.keyboard.insertText('Z');await shape('<ol><li><p>OZne</p></li></ol><p>Tail</p>')
    })
    assert.deepEqual(checks,expectedListChecks);return {status:'passed',checks}
}
