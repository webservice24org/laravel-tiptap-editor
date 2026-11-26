import assert from 'node:assert/strict'

const marks = [
    ['Bold', 'strong,b'], ['Italic', 'em,i'], ['Underline', 'u'],
    ['Strike', 's'], ['Subscript', 'sub'], ['Superscript', 'sup'],
]
export const expectedFormattingChecks = [
    ...marks.flatMap(([name])=>[`${name}: selection apply/remove`, `${name}: stored mark typing`, `${name}: selection-only state`]),
    'combined marks and clear formatting', 'mixed selection bold', 'subscript/superscript exclusion', 'safe inline HTML round trip',
]

// Establish precise native DOM selections in the single-paragraph test fixture.
// No ProseMirror/Tiptap internals, commands or transaction injection are used.
// Offsets count UTF-16 code units; all current fixtures are ASCII.
export async function selectFixtureRange(editor, start, end = start) {
    const actual = await editor.evaluate(async (root, {start, end}) => {
        const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve))
        root.focus({preventScroll: true})
        await nextFrame()
        const p = root.firstElementChild
        if (root.children.length !== 1 || p?.tagName !== 'P') throw new Error('Expected a single fixture paragraph')
        const text = p.textContent ?? ''
        if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || end > text.length) throw new Error('Invalid fixture range')
        const point = offset => {
            const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT)
            let node
            while ((node = walker.nextNode())) {
                if (offset <= node.length) return [node, offset]
                offset -= node.length
            }
            if (offset === 0 && text.length === 0) return [p, 0]
            throw new Error('Could not locate fixture text offset')
        }
        const selection = window.getSelection()
        if (!selection) throw new Error('Native selection unavailable')
        const range = document.createRange()
        const [a, ao] = point(start), [b, bo] = point(end)
        range.setStart(a, ao); range.setEnd(b, bo)
        selection.removeAllRanges(); selection.addRange(range)
        // Allow native selectionchange and editor DOM observers to process the selection.
        await nextFrame(); await nextFrame()
        const offsetOf = (node, offset) => {
            if (!node || !p.contains(node)) return null
            const prefix = document.createRange()
            prefix.selectNodeContents(p); prefix.setEnd(node, offset)
            return prefix.toString().length
        }
        return {
            focused: document.activeElement === root,
            anchor: offsetOf(selection.anchorNode, selection.anchorOffset),
            focus: offsetOf(selection.focusNode, selection.focusOffset),
            text: selection.toString(), expectedText: text.slice(start, end),
            collapsed: selection.isCollapsed,
        }
    }, {start, end})
    assert.deepEqual(actual, {focused:true, anchor:start, focus:end, text:actual.expectedText, expectedText:actual.expectedText, collapsed:start===end}, 'Native fixture selection mismatch: '+JSON.stringify(actual))
    return actual
}

// Exercise the actual installed package via its rendered UI. No editor internals,
// test-only commands, React state injection or artificial transaction dispatch.
export async function runFormatting(page, editor) {
    const checks=[]
    const button=name=>page.getByRole('toolbar',{name:'Text formatting controls'}).getByRole('button',{name,exact:true})
    const check=async (name,fn)=>{
        try {await fn();checks.push(name);console.log('Formatting passed: '+name)}
        catch(e){
            // Fixture data only. Preserve diagnostics in the failed browser artifact.
            try {
                const diagnostic=await page.evaluate(()=>{
                    const ed=document.querySelector('.mw-tiptap-content[contenteditable="true"]'),sel=window.getSelection()
                    const describe=node=>node?{name:node.nodeName,text:node.textContent?.slice(0,200)}:null
                    return {html:ed?.innerHTML, saved:document.querySelector('#html')?.textContent, changes:document.querySelector('#changes')?.textContent, generation:document.querySelector('#format-generation')?.textContent, focused:document.activeElement?.outerHTML.slice(0,300), selection:{text:sel?.toString(),collapsed:sel?.isCollapsed,anchor:describe(sel?.anchorNode),anchorOffset:sel?.anchorOffset,focus:describe(sel?.focusNode),focusOffset:sel?.focusOffset}, buttons:[...document.querySelectorAll('.mw-tiptap-toolbar button')].map(b=>({name:b.getAttribute('aria-label'),pressed:b.getAttribute('aria-pressed'),disabled:b.disabled,active:b.classList.contains('is-active')}))}
                })
                console.error('Formatting diagnostics: '+JSON.stringify(diagnostic))
            }catch(diagnosticError){console.error('Formatting diagnostics unavailable: '+diagnosticError.message)}
            throw new Error('Formatting failed: '+name+' — '+e.message,{cause:e})
        }
    }
    async function reset(html,text) {
        const before=Number(await page.locator('#format-generation').textContent())
        await page.locator('#format-source').fill(html)
        await page.locator('#format-reset').click()
        await page.waitForFunction(({before,text})=>Number(document.querySelector('#format-generation')?.textContent)===before+1&&document.querySelector('.mw-tiptap-content[contenteditable="true"]')?.textContent===text&&document.querySelector('#changes')?.textContent==='0',{before,text})
        await editor.waitFor({state:'visible'})
    }
    async function selectLine(text) {
        assert.equal(await editor.textContent(),text,'Fixture text mismatch before selecting')
        const selection=await selectFixtureRange(editor,0,text.length)
        assert.equal(selection.text,text,'Expected full fixture text selection')
    }
    async function moveTo(offset) {
        await selectFixtureRange(editor,offset)
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
            await reset('<p>Base</p>','Base');await moveTo(4);await state(name,false)
            await button(name).click();await state(name,true);await page.keyboard.insertText('X')
            await content(selector,'X','BaseX');await state(name,true)
            await button(name).click();await state(name,false);await page.keyboard.insertText('Y')
            await content(selector,'X','BaseXY');await state(name,false)
        })
        await check(`${name}: selection-only state`,async()=>{
            await reset(`<p><${tag}>Marked</${tag}> plain</p>`,'Marked plain')
            await moveTo(3);await state(name,true)
            await moveTo('Marked plain'.length);await state(name,false)
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
        await reset(html,'ABCDEF');await moveTo(6);await page.keyboard.insertText('!')
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
