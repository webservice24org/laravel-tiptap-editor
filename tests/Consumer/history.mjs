import assert from 'node:assert/strict'
import { selectBlocks, blockDocumentMatches } from './blocks.mjs'

export const expectedHistoryChecks = ['initial history boundaries','toolbar undo and redo typing','keyboard undo and both redo shortcuts','new edit invalidates redo','undo and redo inline formatting','undo and redo block formatting','undo and redo list conversion','keyboard bold italic underline strike','keyboard script mark switching','keyboard heading and paragraph','selection-only history stability','history shortcuts outside editor']

export async function runHistory(page, editor) {
    const checks=[]
    const toolbar=page.getByRole('toolbar',{name:'Text formatting controls'})
    const button=name=>toolbar.getByRole('button',{name,exact:true})
    const undo=button('Undo'),redo=button('Redo')
    // Match the platform on which Chromium runs, not the Node host's OS.
    const mod=await page.evaluate(()=>/Mac|iPhone|iPad|iPod/.test(navigator.platform))?'Meta':'Control'
    const key=s=>page.keyboard.press(`${mod}+${s}`)
    async function reset(html='<p>AB</p>',text='AB') {
        const before=Number(await page.locator('#format-generation').textContent())
        await page.locator('#format-source').fill(html);await page.locator('#format-reset').click()
        await page.waitForFunction(({before,text})=>Number(document.querySelector('#format-generation')?.textContent)===before+1&&document.querySelector('.mw-tiptap-content[contenteditable="true"]')?.textContent===text&&document.querySelector('#changes')?.textContent==='0',{before,text})
        await editor.waitFor({state:'visible'})
    }
    async function availability(canUndo,canRedo){
        await page.waitForFunction(({canUndo,canRedo})=>{
            const a=document.querySelector('button[aria-label="Undo"]'),b=document.querySelector('button[aria-label="Redo"]')
            return a&&b&&a.disabled===!canUndo&&b.disabled===!canRedo
        },{canUndo,canRedo})
    }
    async function plain(text,mark=null){
        await page.waitForFunction(({text,mark})=>{
            const ed=document.querySelector('.mw-tiptap-content[contenteditable="true"]'),html=document.querySelector('#html')?.textContent
            if(!ed||typeof html!=='string'||Number(document.querySelector('#changes')?.textContent)<=0)return false
            return [ed,new DOMParser().parseFromString(html,'text/html').body].every(root=>{
                if(root.children.length!==1||root.firstElementChild?.tagName!=='P'||root.textContent!==text)return false
                const p=root.firstElementChild, tags=[...p.querySelectorAll('*')]
                return mark?tags.length===1&&tags[0].tagName.toLowerCase()===mark&&tags[0].textContent===text:tags.length===0
            })
        },{text,mark})
    }
    async function shape(expected){await page.waitForFunction(blockDocumentMatches,{expected,allowTrailingParagraph:true})}
    async function pressed(name,value){await page.waitForFunction(({name,value})=>document.querySelector(`button[aria-label="${name}"]`)?.getAttribute('aria-pressed')===String(value),{name,value})}
    async function check(name,fn){
        try{await fn();checks.push(name);console.log('History passed: '+name)}catch(error){
            const diagnostics=await page.evaluate(()=>({html:document.querySelector('.mw-tiptap-content')?.innerHTML,saved:document.querySelector('#html')?.textContent,changes:document.querySelector('#changes')?.textContent,selection:getSelection()?.toString(),focus:document.activeElement?.outerHTML.slice(0,400),historyEvents:window.__historyIsolationEvents??[],buttons:[...document.querySelectorAll('button[aria-label]')].map(b=>({name:b.getAttribute('aria-label'),pressed:b.getAttribute('aria-pressed'),disabled:b.disabled}))})).catch(()=>null)
            console.error('History diagnostics: '+JSON.stringify(diagnostics));throw Error('History failed: '+name,{cause:error})
        }
    }
    await check('initial history boundaries',async()=>{
        await reset();await selectBlocks(editor,'p');await availability(false,false)
        const html=await editor.innerHTML(),saved=await page.locator('#html').textContent()
        await key('KeyZ');await key('Shift+KeyZ');await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await availability(false,false)
        assert.equal(await editor.innerHTML(),html);assert.equal(await page.locator('#html').textContent(),saved);assert.equal(await page.locator('#changes').textContent(),'0')
    })
    await check('toolbar undo and redo typing',async()=>{
        await reset();await selectBlocks(editor,'p');await page.keyboard.insertText('X');await plain('AXB');await availability(true,false)
        await undo.click();await plain('AB');await availability(false,true)
        await redo.click();await plain('AXB');await availability(true,false)
    })
    await check('keyboard undo and both redo shortcuts',async()=>{
        await reset();await selectBlocks(editor,'p');await page.keyboard.insertText('X');await plain('AXB');await availability(true,false)
        await key('KeyZ');await plain('AB');await availability(false,true)
        await key('Shift+KeyZ');await plain('AXB');await availability(true,false)
        await key('KeyZ');await plain('AB');await key('KeyY');await plain('AXB');await availability(true,false)
    })
    await check('new edit invalidates redo',async()=>{
        await reset();await selectBlocks(editor,'p');await page.keyboard.insertText('X');await plain('AXB');await undo.click();await plain('AB');await availability(false,true)
        await selectBlocks(editor,'p');await page.keyboard.insertText('Y');await plain('AYB');await availability(true,false)
        const count=await page.locator('#changes').textContent();await key('Shift+KeyZ');await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await plain('AYB');await availability(true,false);assert.equal(await page.locator('#changes').textContent(),count)
    })
    await check('undo and redo inline formatting',async()=>{
        await reset();await selectBlocks(editor,'p','p',true);await button('Bold').click();await plain('AB','strong');await availability(true,false)
        await undo.click();await plain('AB');await availability(false,true)
        await redo.click();await plain('AB','strong');await availability(true,false)
    })
    await check('undo and redo block formatting',async()=>{
        await reset();await selectBlocks(editor,'p');await page.getByRole('combobox',{name:'Text format',exact:true}).selectOption('h2');await shape([['h2','AB']]);await availability(true,false)
        await undo.click();await shape([['p','AB']]);await availability(false,true)
        await redo.click();await shape([['h2','AB']]);await availability(true,false)
    })
    await check('undo and redo list conversion',async()=>{
        await reset();await selectBlocks(editor,'p');await button('Bullet List').click();await shape([['ul','AB']]);await availability(true,false)
        await undo.click();await shape([['p','AB']]);await availability(false,true)
        await redo.click();await shape([['ul','AB']]);await availability(true,false)
        await page.waitForFunction(()=>{const ed=document.querySelector('.mw-tiptap-content'),saved=new DOMParser().parseFromString(document.querySelector('#html')?.textContent??'','text/html').body;return [ed,saved].every(root=>root?.querySelector('ul>li>p')?.textContent==='AB'&&root.querySelectorAll('li').length===1)})
    })
    await check('keyboard bold italic underline strike',async()=>{
        for(const [label,shortcut,tag] of [['Bold','KeyB','strong'],['Italic','KeyI','em'],['Underline','KeyU','u'],['Strike','Shift+KeyS','s']]){
            await reset();await selectBlocks(editor,'p','p',true);await key(shortcut);await plain('AB',tag);await pressed(label,true)
            await key(shortcut);await plain('AB');await pressed(label,false)
        }
    })
    await check('keyboard script mark switching',async()=>{
        await reset();await selectBlocks(editor,'p','p',true);await key('Comma');await plain('AB','sub');await pressed('Subscript',true)
        await key('Period');await plain('AB','sup');await pressed('Subscript',false);await pressed('Superscript',true)
        await key('Comma');await plain('AB','sub');await pressed('Superscript',false);await key('Comma');await plain('AB');await pressed('Subscript',false)
    })
    await check('keyboard heading and paragraph',async()=>{
        for(const level of [1,2,3]){
            await reset();await selectBlocks(editor,'p');await key(`Alt+Digit${level}`);await shape([[`h${level}`,'AB']]);await key(`Alt+Digit${level}`);await shape([['p','AB']])
        }
    })
    await check('selection-only history stability',async()=>{
        await reset('<p>AB</p><p>CD</p>','ABCD');await selectBlocks(editor,'p:first-child');await availability(false,false)
        const html=await editor.innerHTML(),saved=await page.locator('#html').textContent()
        await selectBlocks(editor,'p:last-child');await availability(false,false);await selectBlocks(editor,'p:first-child','p:last-child',true);await availability(false,false)
        assert.equal(await editor.innerHTML(),html);assert.equal(await page.locator('#html').textContent(),saved);assert.equal(await page.locator('#changes').textContent(),'0')
    })
    await check('history shortcuts outside editor',async()=>{
        await reset();await selectBlocks(editor,'p');await page.keyboard.insertText('X');await plain('AXB');await availability(true,false)
        const html=await editor.innerHTML(),saved=await page.locator('#html').textContent(),count=await page.locator('#changes').textContent()
        // Observe native delivery, without cancelling or simulating any input.
        await page.evaluate(()=>{
            window.__historyIsolationEvents=[]
            window.__historyIsolationListener=event=>{
                if(!['historyUndo','historyRedo'].includes(event.inputType))return
                const item={type:event.inputType,target:event.target?.id||event.target?.className,focus:document.activeElement?.id||document.activeElement?.className,cancelable:event.cancelable,trusted:event.isTrusted}
                item.prevented=event.defaultPrevented;window.__historyIsolationEvents.push(item)
            }
            document.addEventListener('beforeinput',window.__historyIsolationListener)
        })
        async function unchanged(focusId){
            await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
            assert.equal(await page.evaluate(()=>document.activeElement?.id),focusId)
            assert.equal(await editor.innerHTML(),html);assert.equal(await page.locator('#html').textContent(),saved);assert.equal(await page.locator('#changes').textContent(),count);await availability(true,false)
        }
        try {
            await page.locator('#format-source').focus();await unchanged('format-source')
            for(const shortcut of ['KeyZ','Shift+KeyZ','KeyY']){await key(shortcut);await unchanged('format-source')}
            // A real edit in an independent native host input must retain its own undo/redo.
            const host=page.locator('#history-host-input');await host.focus();await page.keyboard.press('End')
            const original=await host.inputValue();assert.equal(original,'Host')
            await page.keyboard.insertText('X');assert.equal(await host.inputValue(),'HostX');await unchanged('history-host-input')
            await key('KeyZ');assert.equal(await host.inputValue(),'Host');await unchanged('history-host-input')
            await key('Shift+KeyZ');assert.equal(await host.inputValue(),'HostX');await unchanged('history-host-input')
        } finally {
            await page.evaluate(()=>document.removeEventListener('beforeinput',window.__historyIsolationListener))
        }
        // The original editor history must still be usable after focus returns.
        await selectBlocks(editor,'p');await key('KeyZ');await plain('AB');await availability(false,true)
        await key('Shift+KeyZ');await plain('AXB');await availability(true,false)
    })
    assert.deepEqual(checks,expectedHistoryChecks);return {status:'passed',checks}
}
