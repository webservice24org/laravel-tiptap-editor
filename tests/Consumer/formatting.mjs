import assert from 'node:assert/strict'

const marks = [
    ['Bold', 'strong,b'], ['Italic', 'em,i'], ['Underline', 'u'],
    ['Strike', 's'], ['Subscript', 'sub'], ['Superscript', 'sup'],
]
export const expectedFormattingChecks = [
    ...marks.flatMap(([name])=>[`${name}: selection apply/remove`, `${name}: stored mark typing`, `${name}: selection-only state`]),
    'combined marks and clear formatting', 'mixed selection bold', 'subscript/superscript exclusion', 'safe inline HTML round trip',
]

// Exercise the actual installed package via its rendered UI. No editor internals,
// test-only commands, React state injection or artificial transaction dispatch.
export async function runFormatting(page, editor) {
    const checks=[]
    const button=name=>page.getByRole('toolbar',{name:'Text formatting controls'}).getByRole('button',{name,exact:true})
    const check=async (name,fn)=>{try {await fn();checks.push(name);console.log('Formatting passed: '+name)}catch(e){throw new Error('Formatting failed: '+name+' — '+e.message,{cause:e})}}
    async function reset(html,text) {
        const before=Number(await page.locator('#format-generation').textContent())
        await page.locator('#format-source').fill(html)
        await page.locator('#format-reset').click()
        await page.waitForFunction(({before,text})=>Number(document.querySelector('#format-generation')?.textContent)===before+1&&document.querySelector('.mw-tiptap-content[contenteditable="true"]')?.textContent===text&&document.querySelector('#changes')?.textContent==='0',{before,text})
        await editor.waitFor({state:'visible'})
    }
    async function selectLine(text) {
        await editor.click();await page.keyboard.press('Home');await page.keyboard.press('Shift+End')
        await page.waitForFunction(text=>window.getSelection()?.toString()===text,text)
    }
    async function moveTo(offset) {
        await editor.click();await page.keyboard.press('Home')
        for(let i=0;i<offset;i++)await page.keyboard.press('ArrowRight')
        await page.waitForFunction(()=>window.getSelection()?.isCollapsed===true&&document.querySelector('.mw-tiptap-content')?.contains(window.getSelection()?.anchorNode))
    }
    async function state(name,active) {
        const control=button(name)
        await control.waitFor({state:'visible'})
        await page.waitForFunction(({name,active})=>{
            const el=[...document.querySelectorAll('.mw-tiptap-toolbar button')].find(b=>b.getAttribute('aria-label')===name)
            return el?.getAttribute('aria-pressed')===String(active)&&el.classList.contains('is-active')===active&&!el.disabled
        },{name,active})
        assert.equal(await control.isEnabled(),true)
    }
    async function content(selector,marked,text) {
        // Require both the real editor DOM and the sanitized onChange HTML to agree.
        await page.waitForFunction(({selector,marked,text})=>{
            const ed=document.querySelector('.mw-tiptap-content[contenteditable="true"]')
            const html=document.querySelector('#html')?.textContent
            if(!ed||typeof html!=='string'||Number(document.querySelector('#changes')?.textContent)<=0)return false
            const saved=new DOMParser().parseFromString(html,'text/html').body
            return [ed,saved].every(root=>root.textContent===text&&[...root.querySelectorAll(selector)].map(el=>el.textContent).join('')===marked)
        },{selector,marked,text})
    }
    for(const [name,selector] of marks) {
        const tag=selector.split(',')[0]
        await check(`${name}: selection apply/remove`,async()=>{
            await reset('<p>Format target</p>','Format target');await selectLine('Format target');await state(name,false)
            await button(name).click();await content(selector,'Format target','Format target');await state(name,true)
            // The toolbar's mouse interaction must retain the selected text.
            assert.equal(await page.evaluate(()=>window.getSelection()?.toString()),'Format target')
            await button(name).click();await content(selector,'','Format target');await state(name,false)
        })
        await check(`${name}: stored mark typing`,async()=>{
            await reset('<p>Base</p>','Base');await editor.click();await page.keyboard.press('End');await state(name,false)
            await button(name).click();await state(name,true);await page.keyboard.insertText('X')
            await content(selector,'X','BaseX');await state(name,true)
            await button(name).click();await state(name,false);await page.keyboard.insertText('Y')
            await content(selector,'X','BaseXY');await state(name,false)
        })
        await check(`${name}: selection-only state`,async()=>{
            await reset(`<p><${tag}>Marked</${tag}> plain</p>`,'Marked plain')
            await moveTo(3);await state(name,true)
            await page.keyboard.press('End');await state(name,false)
            await moveTo(3);await state(name,true)
            assert.equal(await page.locator('#changes').textContent(),'0','Selection alone must not emit an edit callback')
        })
    }
    await check('combined marks and clear formatting',async()=>{
        await reset('<p>Format target</p>','Format target');await selectLine('Format target')
        for(const [name,selector] of marks.slice(0,5)) {
            await button(name).click();await content(selector,'Format target','Format target');await state(name,true)
        }
        for(const [name,selector] of marks.slice(0,5)) {await content(selector,'Format target','Format target');await state(name,true)}
        await button('Clear Formatting').click()
        for(const [name,selector] of marks) {await content(selector,'','Format target');await state(name,false)}
        assert.equal(await button('Clear Formatting').getAttribute('aria-pressed'),null)
    })
    await check('mixed selection bold',async()=>{
        await reset('<p><strong>Marked</strong> plain</p>','Marked plain');await selectLine('Marked plain');await state('Bold',false)
        await button('Bold').click();await content('strong,b','Marked plain','Marked plain');await state('Bold',true)
        await button('Bold').click();await content('strong,b','','Marked plain');await state('Bold',false)
    })
    await check('subscript/superscript exclusion',async()=>{
        await reset('<p>Format target</p>','Format target');await selectLine('Format target')
        await button('Subscript').click();await content('sub','Format target','Format target')
        await button('Superscript').click();await content('sup','Format target','Format target');await content('sub','','Format target');await state('Subscript',false);await state('Superscript',true)
        await button('Subscript').click();await content('sub','Format target','Format target');await content('sup','','Format target');await state('Superscript',false);await state('Subscript',true)
    })
    await check('safe inline HTML round trip',async()=>{
        const html='<p><strong>A</strong><em>B</em><u>C</u><s>D</s><sub>E</sub><sup>F</sup></p>'
        await reset(html,'ABCDEF');await editor.click();await page.keyboard.press('End');await page.keyboard.insertText('!')
        await page.waitForFunction(()=>document.querySelector('#html')?.textContent?.includes('!'))
        // Typing at a mark boundary may inherit that mark; verify the original six characters remain formatted.
        const pairs=await page.evaluate(()=>{
            const root=new DOMParser().parseFromString(document.querySelector('#html').textContent,'text/html').body
            return ['strong,b','em,i','u','s','sub','sup'].map(sel=>root.querySelector(sel)?.textContent?.[0])
        })
        assert.deepEqual(pairs,['A','B','C','D','E','F'])
        await page.locator('#hide').click();await editor.waitFor({state:'detached'})
        await page.locator('#show-default').click();await editor.waitFor({state:'visible'})
        assert.equal(await editor.innerText(),'ABCDEF!')
        for(const [i,[,selector]] of marks.entries()) assert.equal((await editor.locator(selector).first().textContent())?.[0],'ABCDEF'[i])
    })
    assert.deepEqual(checks,expectedFormattingChecks)
    return {status:'passed',checks}
}
