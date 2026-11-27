import assert from 'node:assert/strict'

// Use only synthetic local content and exact provider fixtures already allowed by browser.mjs.
export async function runSourceSecurity(page) {
    const primary=page.locator('#primary-editor'), live=primary.locator('.mw-tiptap-content[contenteditable="true"]')
    const source=primary.getByRole('textbox',{name:'HTML source',exact:true})
    const highlight=primary.locator('.mw-code-editor-highlight')
    const code=primary.getByRole('button',{name:'HTML code editor',exact:true})
    const visual=primary.getByRole('button',{name:'Visual editor',exact:true})
    const saved=()=>page.locator('#html').textContent(), changes=()=>page.locator('#changes').textContent()
    const checks=[]
    const reset=async(html='<p>Source baseline</p>')=>{
        const before=Number(await page.locator('#format-generation').textContent())
        await page.evaluate(html=>{document.querySelector('#format-source').value=html;document.querySelector('#format-reset').click()},html)
        await page.waitForFunction(({before,html})=>Number(document.querySelector('#format-generation')?.textContent)===before+1&&document.querySelector('#html')?.textContent===html&&document.querySelector('#changes')?.textContent==='0',{before,html})
        await live.waitFor({state:'visible'})
        await page.waitForFunction(()=>document.querySelector('#primary-editor .mw-tiptap-content')?.textContent==='Source baseline')
    }
    const enter=async()=>{await code.click();await source.waitFor({state:'visible'});assert.equal(await live.count(),0)}
    const leave=async()=>{await visual.click();await live.waitFor({state:'visible'});await source.waitFor({state:'detached'})}
    const draft=async(html)=>{await source.fill(html);await page.waitForFunction(html=>document.querySelector('#primary-editor textarea')?.value===html&&document.querySelector('#primary-editor .mw-code-editor-highlight')?.textContent===html,html)}
    const waitSaved=async(text)=>page.waitForFunction(text=>document.querySelector('#html')?.textContent?.includes(text),text)
    const check=async(name,fn)=>{try{await fn();checks.push(name);console.log('Source security passed: '+name)}catch(error){console.error('Source diagnostics: '+JSON.stringify(await page.evaluate(()=>({source:document.querySelector('#primary-editor textarea')?.value,highlight:document.querySelector('#primary-editor .mw-code-editor-highlight')?.textContent,saved:document.querySelector('#html')?.textContent,live:document.querySelector('#primary-editor .mw-tiptap-content')?.innerHTML,changes:document.querySelector('#changes')?.textContent,executed:window.__sourceFixtureExecuted??0})).catch(()=>null)));throw Error('Source security failed: '+name,{cause:error})}}
    const hostile='<p onclick="window.__sourceFixtureExecuted=1">Safe source</p><script>window.__sourceFixtureExecuted=1</script><svg onload="window.__sourceFixtureExecuted=1"></svg><a href="java&#x73;cript:window.__sourceFixtureExecuted=1">Unsafe link</a><img src="data:image/svg+xml,bad" onerror="window.__sourceFixtureExecuted=1"><iframe srcdoc="&lt;script&gt;parent.__sourceFixtureExecuted=1&lt;/script&gt;"></iframe>'
    const assertInert=async()=>assert.equal(await page.evaluate(()=>window.__sourceFixtureExecuted??0),0)
    await check('code entry preserves committed value',async()=>{
        await reset();await enter();assert.equal(await source.inputValue(),'<p>Source baseline</p>');assert.equal(await saved(),'<p>Source baseline</p>');assert.equal(await changes(),'0');assert.equal(await primary.getByRole('combobox',{name:'Text format',exact:true}).isDisabled(),true)
    })
    await check('raw source draft remains inert and local',async()=>{
        await draft(hostile);assert.equal(await highlight.textContent(),hostile);assert.equal(await highlight.locator('script,svg,img,iframe,a,[onclick],[onerror],[onload]').count(),0);assert.equal(await saved(),'<p>Source baseline</p>');assert.equal(await changes(),'0');await assertInert()
    })
    await check('unsafe source sanitized before visual and callback',async()=>{
        await leave();await waitSaved('Safe source');assert.equal(await changes(),'1');assert.doesNotMatch(await saved(),/javascript:|data:image|<script|<svg|srcdoc=|on(?:click|load|error)=/i);assert.equal(await live.locator('script,svg,iframe,[onclick],[onerror],[onload],a[href^="javascript:"]').count(),0);await assertInert()
    })
    await check('escaped code and literal entities round trip',async()=>{
        await reset();await enter();await draft('<p><code>&lt;script&gt; &amp; বাংলা</code></p>');await leave();await waitSaved('&lt;script&gt;');assert.equal(await live.locator('code').textContent(),'<script> & বাংলা');assert.equal(await live.locator('script').count(),0);await enter();assert.match(await source.inputValue(),/&lt;script&gt; &amp; বাংলা/);await leave();await assertInert()
    })
    await check('safe rich source round trip',async()=>{
        await reset();await enter();await draft('<p><strong>বাংলা</strong> <a href="/news/fixture">Link</a></p><table><tbody><tr><td><p>Cell</p></td></tr></tbody></table><figure data-mw-image="true"><img src="/__media/direct.png" alt="Photo"><figcaption>Caption</figcaption></figure><figure data-mw-video="true" data-provider="youtube"><iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe><figcaption>Video</figcaption></figure><article data-mw-news-block="true" data-title="News" data-url="/news/fixture" data-style="card"><h3 data-mw-news-title="true">News</h3></article>');await leave();await waitSaved('data-mw-news-block');
        const verify=async()=>{assert.equal(await live.locator('strong').textContent(),'বাংলা');assert.equal(await live.locator('table td').textContent(),'Cell');assert.equal(await live.locator('img[src="/__media/direct.png"]').count(),1);assert.equal(await live.locator('iframe[src="https://www.youtube.com/embed/dQw4w9WgXcQ"]').count(),1);assert.equal(await live.locator('.mw-news-block-title').textContent(),'News');const html=await saved();for(const token of ['data-mw-image','data-mw-video','data-mw-news-block','<table','/news/fixture'])assert.ok(html.includes(token),token)}
        await verify();await enter();await leave();await verify()
    })
    await check('host replacement supersedes stale code draft',async()=>{
        await reset();await enter();await draft('<p>Stale draft</p>');await page.locator('#host-replace').click();await page.waitForFunction(()=>document.querySelector('#primary-editor textarea')?.value==='<p>Host replaced</p>');assert.equal(await changes(),'0');await leave();assert.equal(await live.textContent(),'Host replaced');assert.equal(await saved(),'<p>Host replaced</p>');assert.doesNotMatch(await saved(),/Stale draft/)
    })
    await check('format action remains local until visual commit',async()=>{
        await reset();await enter();await draft('<p>Formatted source</p><p>Second</p>');await primary.getByRole('button',{name:'Format',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#primary-editor .mw-code-editor-status')?.textContent==='Formatted');assert.equal(await saved(),'<p>Source baseline</p>');assert.equal(await changes(),'0');await leave();await waitSaved('Formatted source');assert.equal(await live.locator('p').count(),2);assert.equal(await changes(),'1')
    })
    await check('repeat source switches preserve safe document',async()=>{
        const before=await saved();for(let i=0;i<3;i++){await enter();assert.equal(await source.inputValue(),before);await leave();assert.equal(await saved(),before)}await assertInert()
    })
    return {status:'passed',checks}
}
