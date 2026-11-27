import assert from 'node:assert/strict'

export async function runResponsive(page) {
    const checks=[]
    const viewport=page.viewportSize()
    const primary=page.locator('#primary-editor')
    const root=primary.locator('.mw-tiptap-editor')
    const live=primary.locator('.mw-tiptap-content[contenteditable="true"]')
    const button=name=>primary.getByRole('button',{name,exact:true})
    const reset=async html=>{
        const before=Number(await page.locator('#format-generation').textContent())
        await page.evaluate(html=>{document.querySelector('#format-source').value=html;document.querySelector('#format-reset').click()},html)
        await page.waitForFunction(({before,html})=>Number(document.querySelector('#format-generation')?.textContent)===before+1&&document.querySelector('#html')?.textContent===html&&document.querySelector('#changes')?.textContent==='0',{before,html})
        await live.waitFor({state:'visible'})
    }
    const check=async(name,fn)=>{try{await fn();checks.push(name);console.log('Responsive passed: '+name)}catch(error){throw Error('Responsive failed: '+name,{cause:error})}}
    const inside=async locator=>{
        const bounds=await locator.boundingBox();assert.ok(bounds,'Element has no bounds')
        assert.ok(bounds.x>=-1&&bounds.x+bounds.width<=page.viewportSize().width+1,JSON.stringify(bounds))
    }
    const contains=async locator=>{
        const outer=await root.boundingBox(), inner=await locator.boundingBox()
        assert.ok(outer&&inner);assert.ok(inner.x>=outer.x-1&&inner.x+inner.width<=outer.x+outer.width+1,JSON.stringify({outer,inner}))
    }
    // Host debug outputs are not editor UI. Contain those outputs, without modifying the editor CSS.
    const hostStyle=await page.addStyleTag({content:'main{min-width:0;max-width:100%} main > pre,main > output{overflow-wrap:anywhere;white-space:pre-wrap} main > input{max-width:100%;box-sizing:border-box} #primary-editor{display:grid;grid-template-columns:minmax(0,1fr);min-width:0}'})
    try {
        await check('narrow editor and toolbar containment',async()=>{
            for(const width of [320,390,768]) {
                await page.setViewportSize({width,height:640});await reset('<p>Responsive fixture</p>')
                await inside(root);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Page-level horizontal overflow');await contains(primary.locator('.mw-tiptap-toolbar-main'));await contains(primary.locator('.mw-tiptap-toolbar'))
                await button('HTML code editor').scrollIntoViewIfNeeded();await button('HTML code editor').click();await primary.getByRole('textbox',{name:'HTML source',exact:true}).waitFor();await button('Visual editor').click();await live.waitFor()
            }
            await page.setViewportSize({width:320,height:640})
        })
        await check('wide table stays locally scrollable',async()=>{
            await reset('<p>Wide table</p><table><tbody><tr>'+Array.from({length:8},(_,i)=>'<td><p>Cell '+i+'</p></td>').join('')+'</tr></tbody></table>')
            const wrapper=live.locator('.tableWrapper');await wrapper.waitFor();assert.equal(await live.locator('td').count(),8)
            for (const width of [320,390]) {
                await page.setViewportSize({width,height:640});await contains(wrapper)
                const metrics=await wrapper.evaluate(e=>{
                    const table=e.querySelector('table');const style=getComputedStyle(table)
                    return {viewport:innerWidth,pageWidth:document.documentElement.scrollWidth,clientWidth:e.clientWidth,scrollWidth:e.scrollWidth,overflowX:getComputedStyle(e).overflowX,tableWidth:table.getBoundingClientRect().width,tableMinWidth:style.minWidth,tableMaxWidth:style.maxWidth,tableInlineStyle:table.getAttribute('style')}
                })
                assert.equal(metrics.viewport,width)
                assert.ok(metrics.scrollWidth>metrics.clientWidth,'Wide table has no local overflow: '+JSON.stringify(metrics))
                assert.ok(['auto','scroll'].includes(metrics.overflowX),'Table wrapper is not scrollable: '+JSON.stringify(metrics))
                await wrapper.evaluate(e=>{e.scrollLeft=0;e.scrollLeft=e.scrollWidth})
                assert.ok(await wrapper.evaluate(e=>e.scrollLeft>0),'Table did not scroll: '+JSON.stringify(metrics))
                assert.ok(metrics.pageWidth<=width+1,'Page-level table overflow: '+JSON.stringify(metrics));await inside(root)
            }
            await page.setViewportSize({width:320,height:640})
        })
        await check('responsive rich media and Bengali content',async()=>{
            const text='বাংলা সংবাদ '+ 'দীর্ঘলেখা'.repeat(30)
            await reset('<p>'+text+'</p><figure data-mw-image="true" data-width="100"><img src="/__media/direct.png" alt="Photo"><figcaption>বাংলা</figcaption></figure><figure data-mw-video="true" data-provider="youtube"><iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe><figcaption>Video</figcaption></figure><article data-mw-news-block="true" data-title="বাংলা সংবাদ" data-url="/news/fixture" data-style="compact"><h3 data-mw-news-title="true">বাংলা সংবাদ</h3></article>')
            const image=live.locator('img');await image.waitFor();await contains(image);const video=live.locator('iframe');await video.waitFor();await contains(video);const news=live.locator('.mw-news-block-title');await news.waitFor();await contains(news);assert.equal(await live.locator('p').first().textContent(),text);await inside(root)
        })
        await check('code source containment and round trip',async()=>{
            await reset('<p>Source fixture</p>');await button('HTML code editor').click();const source=primary.getByRole('textbox',{name:'HTML source',exact:true});await source.waitFor()
            const html='<p>'+ 'longsource'.repeat(100)+'</p>';await source.fill(html);await contains(source);await inside(root);assert.equal(await source.inputValue(),html)
            await button('Visual editor').click();await live.waitFor();await page.waitForFunction(html=>document.querySelector('#html')?.textContent===html,html)
        })
        await check('mobile dialog bounds and accessible title',async()=>{
            await reset('<p>Dialog fixture</p>');await page.setViewportSize({width:320,height:420});await button('Add image').click();const dialog=primary.getByRole('dialog');await dialog.waitFor();await inside(dialog)
            assert.ok(await dialog.evaluate(e=>{const b=e.getBoundingClientRect();return b.top>=0&&b.bottom<=innerHeight+1&&!!document.getElementById(e.getAttribute('aria-labelledby'))?.textContent?.trim()}));await dialog.getByRole('button',{name:'Close',exact:true}).click();await dialog.waitFor({state:'detached'})
        })
        await check('dialog keyboard focus cycle and Escape',async()=>{
            const opener=button('Add image');await opener.focus();await page.keyboard.press('Enter');const dialog=primary.getByRole('dialog');await dialog.waitFor()
            await page.waitForFunction(()=>document.querySelector('.mw-dialog')?.contains(document.activeElement));
            const candidates=dialog.locator('button, input, select, textarea, a[href], [tabindex]');const eligible=()=>candidates.evaluateAll(es=>es.filter(e=>e.tabIndex>=0&&!e.matches(':disabled')&&e.getClientRects().length>0&&getComputedStyle(e).visibility!=='hidden').map(e=>es.indexOf(e)))
            const indices=await eligible();assert.ok(indices.length>1);const first=candidates.nth(indices[0]),last=candidates.nth(indices.at(-1));await last.focus();await page.keyboard.press('Tab');assert.ok(await first.evaluate(e=>e===document.activeElement&&e.matches(':focus-visible')&&getComputedStyle(e).outlineStyle!=='none'));await page.keyboard.press('Shift+Tab');assert.ok(await last.evaluate(e=>e===document.activeElement));await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});await page.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='Add image');assert.ok(await opener.evaluate(e=>e===document.activeElement));assert.equal(await page.locator('#changes').textContent(),'0')
        })
        return {status:'passed',checks}
    } finally {await hostStyle.evaluate(e=>e.remove());if(viewport)await page.setViewportSize(viewport)}
}
