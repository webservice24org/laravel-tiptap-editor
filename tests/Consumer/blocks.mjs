import assert from 'node:assert/strict'

export const expectedBlockChecks=['heading 1 round trip','heading 2 round trip','heading 3 round trip','selection-only block state','mixed block selection','blockquote toggle','horizontal rule','clear block formatting','safe code markup round trip','source mode format guard']

// Native DOM Range setup only. Never dispatch internal editor transactions.
async function selectBlocks(editor, first, last=first, full=false) {
    const result=await editor.evaluate(async(root,{first,last,full})=>{
        const frame=()=>new Promise(resolve=>requestAnimationFrame(resolve))
        root.focus({preventScroll:true});await frame()
        const a=root.querySelector(first),b=root.querySelector(last)
        if(!a||!b)throw Error('Missing block selection target')
        const start=document.createTreeWalker(a,NodeFilter.SHOW_TEXT).nextNode()
        const walker=document.createTreeWalker(b,NodeFilter.SHOW_TEXT);let end=null,n
        while((n=walker.nextNode()))end=n
        if(!start||!end)throw Error('Expected nonempty text blocks')
        const range=document.createRange();range.setStart(start,full?0:Math.min(1,start.length));range.setEnd(full?end:start,full?end.length:Math.min(1,start.length))
        const expected=range.toString(),sel=getSelection();sel.removeAllRanges();sel.addRange(range);await frame();await frame()
        return {focused:document.activeElement===root,text:sel.toString(),expected,collapsed:sel.isCollapsed,anchor:a.contains(sel.anchorNode),focus:(full?b:a).contains(sel.focusNode)}
    },{first,last,full})
    assert.deepEqual(result,{focused:true,text:result.expected,expected:result.expected,collapsed:!full,anchor:true,focus:true},'Native block selection mismatch')
}

// StarterKit may append one empty paragraph after a non-paragraph block.
// Accept only that exact final top-level placeholder when explicitly requested.
// Do not filter arbitrary empty nodes, nested paragraphs, or extra content.
export function blockDocumentMatches({expected, allowTrailingParagraph}) {
    const ed=document.querySelector('.mw-tiptap-content[contenteditable="true"]')
    const html=document.querySelector('#html')?.textContent
    if(!ed||typeof html!=='string'||Number(document.querySelector('#changes')?.textContent)<=0)return false
    const saved=new DOMParser().parseFromString(html,'text/html').body
    function isEmptyTrailingParagraph(node) {
        if(node?.tagName!=='P'||node.attributes.length!==0||node.textContent!=='')return false
        if(node.childNodes.length===0)return true
        const br=node.firstChild
        return node.childNodes.length===1&&br.nodeName==='BR'&&br.attributes.length===1&&br.getAttribute('class')==='ProseMirror-trailingBreak'
    }
    return [ed,saved].every(root=>{
        if([...root.childNodes].some(n=>n.nodeType!==Node.ELEMENT_NODE))return false
        const nodes=[...root.children]
        if(allowTrailingParagraph&&nodes.length===expected.length+1&&isEmptyTrailingParagraph(nodes.at(-1)))nodes.pop()
        return nodes.length===expected.length&&nodes.every((n,i)=>n.tagName.toLowerCase()===expected[i][0]&&n.textContent===expected[i][1])
    })
}

export async function runBlocks(page,editor) {
    const checks=[],format=page.getByRole('combobox',{name:'Text format',exact:true}),button=name=>page.getByRole('toolbar',{name:'Text formatting controls'}).getByRole('button',{name,exact:true})
    async function reset(html,text){
        const before=Number(await page.locator('#format-generation').textContent())
        await page.locator('#format-source').fill(html);await page.locator('#format-reset').click()
        await page.waitForFunction(({before,text})=>Number(document.querySelector('#format-generation')?.textContent)===before+1&&document.querySelector('.mw-tiptap-content[contenteditable="true"]')?.textContent===text&&document.querySelector('#changes')?.textContent==='0',{before,text})
        await editor.waitFor({state:'visible'})
    }
    async function state(value){await page.waitForFunction(v=>document.querySelector('.mw-tiptap-format-select')?.value===v,value)}
    async function select(value){await format.selectOption(value);await state(value)}
    async function content(selector,text,count=1){
        await page.waitForFunction(({selector,text,count})=>{
            const ed=document.querySelector('.mw-tiptap-content[contenteditable="true"]'),html=document.querySelector('#html')?.textContent
            if(!ed||typeof html!=='string'||Number(document.querySelector('#changes')?.textContent)<=0)return false
            const saved=new DOMParser().parseFromString(html,'text/html').body
            return [ed,saved].every(root=>{const nodes=[...root.querySelectorAll(selector)];return nodes.length===count&&nodes.map(n=>n.textContent).join('')===text})
        },{selector,text,count})
    }
    async function documentShape(expected,allowTrailingParagraph=false){
        await page.waitForFunction(blockDocumentMatches,{expected,allowTrailingParagraph})
    }
    async function check(name,fn){try{await fn();checks.push(name);console.log('Block formatting passed: '+name)}catch(e){try{console.error('Block diagnostics: '+JSON.stringify(await page.evaluate(()=>({html:document.querySelector('.mw-tiptap-content')?.innerHTML,saved:document.querySelector('#html')?.textContent,changes:document.querySelector('#changes')?.textContent,format:document.querySelector('.mw-tiptap-format-select')?.outerHTML,formatValue:document.querySelector('.mw-tiptap-format-select')?.value,blocks:[...document.querySelectorAll('.mw-tiptap-content > *')].map(n=>({tag:n.tagName,html:n.outerHTML})),selection:{text:getSelection()?.toString(),anchor:getSelection()?.anchorNode?.parentElement?.outerHTML,anchorOffset:getSelection()?.anchorOffset,focus:getSelection()?.focusNode?.parentElement?.outerHTML,focusOffset:getSelection()?.focusOffset},focused:document.activeElement?.outerHTML.slice(0,250)}))))}catch{}throw Error('Block formatting failed: '+name+' — '+e.message,{cause:e})}}
    for(const level of [1,2,3])await check('heading '+level+' round trip',async()=>{
        await reset('<p><strong>Block target</strong></p>','Block target');await selectBlocks(editor,'p');await state('paragraph')
        await select('h'+level);await content('h'+level,'Block target');await documentShape([['h'+level,'Block target']],true);await content('h'+level+' strong,b','Block target')
        await select('paragraph');await documentShape([['p','Block target']],true);await content('p strong,b','Block target');await content('h1,h2,h3','',0)
    })
    await check('selection-only block state',async()=>{
        await reset('<p>Plain</p><h1>One</h1><h2>Two</h2><h3>Three</h3>','PlainOneTwoThree')
        for(const [tag,value] of [['p','paragraph'],['h1','h1'],['h2','h2'],['h3','h3'],['p','paragraph']]){await selectBlocks(editor,tag);await state(value)}
        assert.equal(await page.locator('#changes').textContent(),'0')
    })
    await check('mixed block selection',async()=>{
        await reset('<p>First</p><h2>Second</h2>','FirstSecond');await selectBlocks(editor,'p','h2',true);await state('other')
        await select('h3');await content('h3','FirstSecond',2);await documentShape([['h3','First'],['h3','Second']],true);await content('h2','',0)
    })
    await check('blockquote toggle',async()=>{
        await reset('<p>Quote target</p>','Quote target');await selectBlocks(editor,'p','p',true)
        const control=button('Blockquote');assert.equal(await control.getAttribute('aria-pressed'),'false');await control.click();await content('blockquote p','Quote target');await documentShape([['blockquote','Quote target']],true)
        await page.waitForFunction(()=>document.querySelector('button[aria-label="Blockquote"]')?.getAttribute('aria-pressed')==='true')
        assert.equal(await page.evaluate(()=>getSelection()?.toString()),'Quote target');await control.click();await content('blockquote','',0);await documentShape([['p','Quote target']],true)
    })
    await check('horizontal rule',async()=>{
        await reset('<p>Before</p><p>After</p>','BeforeAfter');await selectBlocks(editor,'p:first-child');await button('Horizontal Rule').click();await content('hr','')
        assert.equal(await editor.textContent(),'BeforeAfter');assert.ok((await page.locator('#html').textContent()).includes('After'))
    })
    await check('clear block formatting',async()=>{
        await reset('<h2><strong>Clear target</strong></h2>','Clear target');await selectBlocks(editor,'h2','h2',true);await button('Clear Formatting').click()
        await documentShape([['p','Clear target']],true);await content('h1,h2,h3,strong,b','',0);await state('paragraph')
    })
    await check('safe code markup round trip',async()=>{
        await reset('<p><code>inline &lt;x&gt;</code></p><pre><code>line 1&#10;line 2 &amp; more</code></pre>','inline <x>line 1\nline 2 & more')
        await selectBlocks(editor,'pre code');await state('other');await page.keyboard.insertText('Z')
        await content('p code','inline <x>');await content('pre code','lZine 1\nline 2 & more')
        await page.locator('#hide').click();await editor.waitFor({state:'detached'});await page.locator('#show-default').click();await editor.waitFor({state:'visible'})
        assert.equal(await editor.locator('p code').textContent(),'inline <x>');assert.equal(await editor.locator('pre code').textContent(),'lZine 1\nline 2 & more')
    })
    await check('source mode format guard',async()=>{
        await reset('<p>Mode target</p>','Mode target');await selectBlocks(editor,'p');await page.getByRole('button',{name:'HTML code editor',exact:true}).click();assert.equal(await format.isDisabled(),true)
        await page.getByRole('button',{name:'Visual editor',exact:true}).click();await editor.waitFor({state:'visible'});assert.equal(await editor.textContent(),'Mode target');await state('paragraph');assert.equal(await format.isEnabled(),true)
    })
    assert.deepEqual(checks,expectedBlockChecks);return {status:'passed',checks}
}
