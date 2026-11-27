import assert from 'node:assert/strict'
import { selectBlocks } from './blocks.mjs'

export const expectedSynchronizationChecks = ["table context transitions", "cell selection attributes", "split availability on equal-style cells", "cell alignment and undo synchronization", "independent editor state and history"]

export async function runSynchronization(page) {
    const checks=[]
    const primary=page.locator('#primary-editor'), editor=primary.locator('.mw-tiptap-content[contenteditable="true"]')
    const toolbar=primary.getByRole('toolbar',{name:'Text formatting controls'})
    const table=primary.getByRole('toolbar',{name:'Table editing controls'})
    const mainButton=name=>toolbar.getByRole('button',{name,exact:true})
    const tableButton=name=>table.getByRole('button',{name,exact:true})
    const frames=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
    const fixture='<p>Before</p><table><tbody><tr><td style="text-align: left; vertical-align: top"><p>First</p></td><td style="text-align: right; vertical-align: bottom"><p>Second</p></td></tr></tbody></table><p>After</p>'
    async function reset(html,text){
        const before=Number(await page.locator('#format-generation').textContent())
        await page.locator('#format-source').fill(html);await page.locator('#format-reset').click()
        await page.waitForFunction(({before,text})=>Number(document.querySelector('#format-generation')?.textContent)===before+1&&document.querySelector('#primary-editor .mw-tiptap-content')?.textContent===text&&document.querySelector('#changes')?.textContent==='0',{before,text})
        await editor.waitFor({state:'visible'})
    }
    async function state(){return {live:await editor.innerHTML(),saved:await page.locator('#html').textContent(),count:await page.locator('#changes').textContent()}}
    async function stable(before){await frames();assert.deepEqual(await state(),before,'Selection-only interaction changed primary document')}
    async function pressed(locator,value){await locator.waitFor({state:'visible'});await page.waitForFunction(({title,value})=>document.querySelector(`#primary-editor .mw-table-toolbar button[title="${title}"]`)?.getAttribute('aria-pressed')===String(value),{title:await locator.getAttribute('title'),value})}
    async function availability(locator,enabled){await locator.waitFor({state:'visible'});await page.waitForFunction(({label,enabled})=>{const b=[...document.querySelectorAll('#primary-editor .mw-table-toolbar button')].find(b=>b.textContent.trim()===label);return b&&b.disabled===!enabled},{label:(await locator.textContent()).trim(),enabled})}
    async function restoredContext(){
        await frames()
        const context=await editor.evaluate(root=>{
            const selection=root.ownerDocument.getSelection()
            const element=node=>node?.nodeType===1?node:node?.parentElement
            const anchor=element(selection?.anchorNode),focus=element(selection?.focusNode)
            if(!selection||selection.rangeCount!==1||!anchor||!focus||!root.contains(anchor)||!root.contains(focus)||root.ownerDocument.activeElement!==root)return null
            const cell=anchor.closest('td,th'),focusCell=focus.closest('td,th')
            if(cell!==focusCell)return null
            return cell?{inTable:true,cell:cell.textContent,alignment:cell.style.textAlign}:{inTable:false}
        })
        assert.ok(context,'Undo must restore a valid focused selection in the primary editor')
        if(context.inTable){
            assert.ok(['First','Second'].includes(context.cell),'Unexpected restored cell')
            assert.equal(context.alignment,context.cell==='First'?'left':'right','Restored cell alignment differs')
            await table.waitFor({state:'visible'});await mainButton('Align Left').waitFor({state:'hidden'})
            for(const alignment of ['left','center','right','justify'])await pressed(table.locator(`button[title="${alignment==='justify'?'Justify cell text':'Align cell '+alignment}"]`),alignment===context.alignment)
        }else{
            await table.waitFor({state:'hidden'});await mainButton('Align Left').waitFor({state:'visible'})
        }
        console.log('Undo restored selection context: '+JSON.stringify(context))
    }
    async function check(name,fn){try{await fn();checks.push(name);console.log('Synchronization passed: '+name)}catch(error){console.error('Synchronization diagnostics: '+JSON.stringify(await page.evaluate(()=>({live:document.querySelector('#primary-editor .mw-tiptap-content')?.innerHTML,saved:document.querySelector('#html')?.textContent,changes:document.querySelector('#changes')?.textContent,secondary:document.querySelector('#secondary-editor .mw-tiptap-content')?.innerHTML,secondarySaved:document.querySelector('#secondary-html')?.textContent,selection:getSelection()?.toString(),selectionEndpoints:[getSelection()?.anchorNode,getSelection()?.focusNode].map((n,i)=>({node:n?.nodeName,parent:n?.parentElement?.outerHTML.slice(0,250),offset:i===0?getSelection()?.anchorOffset:getSelection()?.focusOffset})),focus:document.activeElement?.outerHTML.slice(0,400),controls:[...document.querySelectorAll('.mw-tiptap-editor button')].map(b=>({label:b.getAttribute('aria-label')||b.title||b.textContent.trim(),pressed:b.getAttribute('aria-pressed'),disabled:b.disabled}))})).catch(()=>null)));throw Error('Synchronization failed: '+name,{cause:error})}}
    await check('table context transitions',async()=>{
        await reset(fixture,'BeforeFirstSecondAfter');await selectBlocks(editor,'p');await table.waitFor({state:'hidden'});await mainButton('Align Left').waitFor({state:'visible'});const before=await state()
        await selectBlocks(editor,'td:first-child p');await table.waitFor({state:'visible'});await mainButton('Align Left').waitFor({state:'hidden'});await stable(before)
        await selectBlocks(editor,':scope > p:last-child');await table.waitFor({state:'hidden'});await mainButton('Align Left').waitFor({state:'visible'});await stable(before)
    })
    await check('cell selection attributes',async()=>{
        await reset(fixture,'BeforeFirstSecondAfter');await selectBlocks(editor,'td:first-child p');await table.waitFor({state:'visible'});const before=await state()
        const left=table.locator('button[title="Align cell left"]'),right=table.locator('button[title="Align cell right"]'),top=table.locator('button[title="Align top"]'),bottom=table.locator('button[title="Align bottom"]')
        await pressed(left,true);await pressed(right,false);await pressed(top,true);await pressed(bottom,false)
        await selectBlocks(editor,'td:last-child p');await pressed(left,false);await pressed(right,true);await pressed(top,false);await pressed(bottom,true);await stable(before)
        await selectBlocks(editor,'td:first-child p');await pressed(left,true);await pressed(right,false);await pressed(top,true);await pressed(bottom,false);await stable(before)
    })
    await check('split availability on equal-style cells',async()=>{
        const html='<table><tbody><tr><td colspan="2"><p>Wide</p></td></tr><tr><td><p>One</p></td><td><p>Two</p></td></tr></tbody></table><p>After</p>'
        await reset(html,'WideOneTwoAfter');await selectBlocks(editor,'td[colspan="2"] p');await availability(tableButton('Split'),true);await availability(tableButton('Merge'),false);const before=await state()
        await selectBlocks(editor,'tr:nth-child(2) td:first-child p');await availability(tableButton('Split'),false);await availability(tableButton('Merge'),false);await stable(before)
        await selectBlocks(editor,'td[colspan="2"] p');await availability(tableButton('Split'),true);await stable(before)
    })
    await check('cell alignment and undo synchronization',async()=>{
        await reset(fixture,'BeforeFirstSecondAfter');await selectBlocks(editor,'td:first-child p');const left=table.locator('button[title="Align cell left"]'),center=table.locator('button[title="Align cell center"]');await pressed(left,true)
        await center.click();await pressed(center,true);await pressed(left,false)
        await page.waitForFunction(()=>{const live=document.querySelector('#primary-editor .mw-tiptap-content'),saved=new DOMParser().parseFromString(document.querySelector('#html')?.textContent??'','text/html').body;return [live,saved].every(root=>root?.querySelector('td:first-child')?.style.textAlign==='center'&&root.querySelector('td:last-child')?.style.textAlign==='right'&&root.textContent==='BeforeFirstSecondAfter')})
        await mainButton('Undo').click()
        await page.waitForFunction(()=>{const live=document.querySelector('#primary-editor .mw-tiptap-content'),saved=new DOMParser().parseFromString(document.querySelector('#html')?.textContent??'','text/html').body;return [live,saved].every(root=>root?.querySelector('td:first-child')?.style.textAlign==='left'&&root.querySelector('td:last-child')?.style.textAlign==='right'&&root.textContent==='BeforeFirstSecondAfter')})
        await restoredContext()
        assert.equal(await mainButton('Undo').isDisabled(),true,'Undo should exhaust the single formatting event')
        assert.equal(await mainButton('Redo').isEnabled(),true,'Redo should be available after Undo')
        const undone=await state()
        await selectBlocks(editor,'td:first-child p');await pressed(left,true);await pressed(center,false);await pressed(table.locator('button[title="Align cell right"]'),false);await stable(undone)
        await selectBlocks(editor,'td:last-child p');await pressed(left,false);await pressed(center,false);await pressed(table.locator('button[title="Align cell right"]'),true);await stable(undone)
        assert.equal(await mainButton('Undo').isDisabled(),true,'Reselection must not create history')
        assert.equal(await mainButton('Redo').isEnabled(),true,'Reselection must not clear redo')
    })
    await check('independent editor state and history',async()=>{
        await reset('<p><strong>Primary</strong></p>','Primary');await selectBlocks(editor,'p');const before=await state()
        await page.locator('#toggle-secondary').click();const secondary=page.locator('#secondary-editor'),other=secondary.locator('.mw-tiptap-content[contenteditable="true"]'),otherBar=secondary.getByRole('toolbar',{name:'Text formatting controls'});await other.waitFor({state:'visible'})
        try {
            await selectBlocks(other,'p','p',true);assert.equal(await mainButton('Bold').getAttribute('aria-pressed'),'true');assert.equal(await otherBar.getByRole('button',{name:'Bold',exact:true}).getAttribute('aria-pressed'),'false')
            await otherBar.getByRole('button',{name:'Bold',exact:true}).click()
            await page.waitForFunction(()=>document.querySelector('#secondary-editor .mw-tiptap-content p strong')?.textContent==='Other editor'&&document.querySelector('#secondary-html')?.textContent==='<p><strong>Other editor</strong></p>')
            await stable(before);assert.equal(await mainButton('Undo').isDisabled(),true)
            await otherBar.getByRole('button',{name:'Undo',exact:true}).click()
            await page.waitForFunction(()=>!document.querySelector('#secondary-editor .mw-tiptap-content strong')&&document.querySelector('#secondary-html')?.textContent==='<p>Other editor</p>')
            await stable(before);assert.equal(await mainButton('Bold').getAttribute('aria-pressed'),'true');assert.equal(await otherBar.getByRole('button',{name:'Bold',exact:true}).getAttribute('aria-pressed'),'false')
        } finally {await page.locator('#toggle-secondary').click();await secondary.waitFor({state:'detached'})}
        await selectBlocks(editor,'p');await stable(before);assert.equal(await mainButton('Bold').getAttribute('aria-pressed'),'true')
    })
    assert.deepEqual(checks,expectedSynchronizationChecks);return {status:'passed',checks}
}
