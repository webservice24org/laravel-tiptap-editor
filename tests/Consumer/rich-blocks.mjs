import assert from 'node:assert/strict'

const youtube='https://www.youtube.com/embed/dQw4w9WgXcQ', vimeo='https://player.vimeo.com/video/123456789'
// Fulfill only two exact, synthetic subframe navigations, never contact providers.
export function isFixtureVideoRequest(request,page){
    try { return [youtube,vimeo].includes(request.url()) && request.method()==='GET' && request.resourceType()==='document' && request.isNavigationRequest() && request.frame()!==page.mainFrame() } catch { return false }
}
export async function runRichBlocks(page){
    const checks=[], primary=page.locator('#primary-editor'), editor=primary.locator('.mw-tiptap-content[contenteditable="true"]')
    const toolbar=primary.getByRole('toolbar',{name:'Table editing controls'}), button=name=>toolbar.getByRole('button',{name,exact:true})
    const saved=()=>page.locator('#html').textContent(), dialog=name=>page.getByRole('dialog',{name,exact:true})
    const check=async(name,fn)=>{try{await fn();checks.push(name);console.log('Rich block passed: '+name)}catch(e){console.error('Rich block diagnostics: '+JSON.stringify(await page.evaluate(()=>({source:document.querySelector('#format-source')?.value,saved:document.querySelector('#html')?.textContent,live:document.querySelector('#primary-editor .mw-tiptap-content')?.innerHTML,focus:document.activeElement?.outerHTML.slice(0,400)})).catch(()=>null)));throw Error('Rich block failed: '+name,{cause:e})}}
    const reset=async(html='<p>Target</p>')=>{
        const before=Number(await page.locator('#format-generation').textContent())
        await page.evaluate(html=>{document.querySelector('#format-source').value=html;document.querySelector('#format-reset').click()},html)
        await page.waitForFunction(({before,html})=>Number(document.querySelector('#format-generation')?.textContent)===before+1&&document.querySelector('#html')?.textContent===html&&document.querySelector('#changes')?.textContent==='0',{before,html})
        await editor.waitFor({state:'visible'})
    }
    const open=async(name,buttonName)=>{await primary.getByRole('button',{name:buttonName,exact:true}).click();const d=dialog(name);await d.waitFor({state:'visible'});return d}
    const waitTable=(rows,cells)=>page.waitForFunction(({rows,cells})=>{const root=document.querySelector('#primary-editor .mw-tiptap-content'),saved=new DOMParser().parseFromString(document.querySelector('#html')?.textContent??'','text/html');return [root,saved].every(r=>r?.querySelectorAll('table tr').length===rows&&r?.querySelectorAll('table tr > :is(td,th)').length===cells)},{rows,cells})
    const selectCell=async(sel='table tr:first-child > :is(td,th):first-child p')=>{await editor.locator(sel).click();await toolbar.waitFor({state:'visible'})}
    const waitVideo=(src,caption)=>page.waitForFunction(({src,caption})=>{const r=new DOMParser().parseFromString(document.querySelector('#html')?.textContent??'','text/html');const f=r.querySelector('figure[data-mw-video]');return f?.querySelector('iframe')?.getAttribute('src')===src&&f.querySelector('figcaption')?.textContent===caption&&document.querySelector('#primary-editor .mw-video-node iframe')?.getAttribute('src')===src},{src,caption})
    const waitNews=(title,url,style)=>page.waitForFunction(({title,url,style})=>{const r=new DOMParser().parseFromString(document.querySelector('#html')?.textContent??'','text/html');const a=r.querySelector('article[data-mw-news-block]');return a?.getAttribute('data-title')===title&&a.getAttribute('data-url')===url&&a.getAttribute('data-style')===style&&document.querySelector('#primary-editor .mw-news-block-title')?.textContent===title},{title,url,style})
    const sanitize=async(input)=>{
        await page.evaluate(input=>{document.querySelector('#rich-sanitize-source').value=input;document.querySelector('#rich-sanitize').click()},input)
        // The input is uncontrolled and click runs in the same task; wait for React commit.
        await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))
        return page.locator('#rich-sanitized').textContent()
    }
    await check('table insertion and row/column lifecycle',async()=>{
        await reset();const d=await open('Insert Table','Insert table');await d.locator('#mw-table-rows').fill('2');await d.locator('#mw-table-columns').fill('2');await d.getByRole('checkbox').check();await d.getByRole('button',{name:'Insert Table',exact:true}).click();await d.waitFor({state:'hidden'});await waitTable(2,4)
        await selectCell();await button('Row Below').click();await waitTable(3,6)
        await selectCell();await button('Column Right').click();await waitTable(3,9)
        await selectCell('table tr:nth-child(2) > :is(td,th):first-child p');await button('Delete Row').click();await waitTable(2,6)
        await selectCell('table tr:first-child > :is(td,th):nth-child(2) p');await button('Delete Column').click();await waitTable(2,4)
    })
    await check('table header and split round trip',async()=>{
        await reset('<table><tbody><tr><td colspan="2"><p>Wide</p></td></tr><tr><td><p>One</p></td><td><p>Two</p></td></tr></tbody></table><p>After</p>');await selectCell('td[colspan="2"] p');await button('Split').click();await waitTable(2,4)
        await selectCell();await button('Header Row').click();await page.waitForFunction(()=>document.querySelectorAll('#primary-editor table tr:first-child th').length===2&&new DOMParser().parseFromString(document.querySelector('#html')?.textContent??'','text/html').querySelectorAll('tr:first-child th').length===2)
        const h=await saved();await reset(h);await waitTable(2,4);assert.equal(await editor.locator('tr:first-child th').count(),2)
        const clean=await sanitize('<table><tbody><tr><td colspan="0" rowspan="9999" colwidth="bad" onclick="alert(1)">X</td></tr></tbody></table>');assert.doesNotMatch(clean,/colspan=|rowspan=|colwidth=|onclick=/i)
    })
    await check('table deletion',async()=>{await selectCell();await button('Delete Table').click();await waitTable(0,0);assert.match(await saved(),/After/)})
    await check('YouTube insertion and Vimeo replacement',async()=>{
        await reset();const d=await open('Insert Video','Add video');await d.locator('#mw-video-url').fill('https://youtu.be/dQw4w9WgXcQ');await d.locator('#mw-video-caption').fill('ভিডিও caption');await d.getByRole('button',{name:'Insert Video',exact:true}).click();await d.waitFor({state:'hidden'});await waitVideo(youtube,'ভিডিও caption')
        await editor.getByTitle('Select video',{exact:true}).click();await editor.getByRole('button',{name:'Edit URL',exact:true}).click();await editor.getByPlaceholder('YouTube or Vimeo URL').fill('https://vimeo.com/123456789');await editor.getByRole('button',{name:'Save',exact:true}).click();await waitVideo(vimeo,'ভিডিও caption');assert.match(await saved(),/data-provider="vimeo"/)
        const h=await saved();await reset(h);await waitVideo(vimeo,'ভিডিও caption');await editor.getByTitle('Select video',{exact:true}).click();await editor.getByTitle('Delete video',{exact:true}).click();await page.waitForFunction(()=>!document.querySelector('#html')?.textContent?.includes('data-mw-video'))
    })
    await check('video invalid URL rejection',async()=>{
        await reset();const before=await saved(),d=await open('Insert Video','Add video');for(const url of ['https://youtube.com.evil.invalid/watch?v=dQw4w9WgXcQ','https://youtube.com/watch?v=invalid','ftp://youtube.com/watch?v=dQw4w9WgXcQ','https://user@youtube.com/watch?v=dQw4w9WgXcQ','https://youtube.com:443/watch?v=dQw4w9WgXcQ','https://vimeo.com/not-a-video/123']){await d.locator('#mw-video-url').fill(url);assert.equal(await d.locator('iframe').count(),0);await d.getByRole('button',{name:'Insert Video',exact:true}).click();await d.locator('.mw-form-error').waitFor({state:'visible'});assert.equal(await saved(),before)}await d.getByRole('button',{name:'Cancel'}).click()
    })
    await check('video invalid persisted embed rejection',async()=>{
        const bad='<p>Safe</p><figure data-mw-video=""><iframe src="https://www.youtube.com/watch?v=dQw4w9WgXcQ" srcdoc="bad" onload="alert(1)"></iframe></figure>'
        const clean=await sanitize(bad);assert.doesNotMatch(clean,/src=|srcdoc=|onload=/i);await reset(bad);await editor.getByText('Safe',{exact:true}).waitFor({state:'visible'});assert.equal(await editor.locator('.mw-video-node').count(),0)
        const valid=await sanitize(`<figure data-mw-video=""><iframe src="${youtube}"></iframe></figure>`);assert.ok(valid.includes(youtube))
    })
    await check('News Block insertion and remount',async()=>{
        await reset();const d=await open('Insert News Block','Insert news block');await d.locator('#mw-news-title').fill('বাংলা news');await d.locator('#mw-news-url').fill('/news/fixture');await d.locator('#mw-news-thumbnail').fill('/__media/direct.png');await d.locator('#mw-news-category').fill('বাংলাদেশ');await d.locator('#mw-news-excerpt').fill('Summary বাংলা');await d.locator('#mw-news-style').selectOption('compact');await d.getByRole('button',{name:'Insert',exact:true}).click();await d.waitFor({state:'hidden'});await waitNews('বাংলা news','/news/fixture','compact');const h=await saved();assert.match(h,/Summary বাংলা/);assert.match(h,/data-thumbnail="\/__media\/direct.png"/);await reset(h);await waitNews('বাংলা news','/news/fixture','compact')
    })
    await check('News Block edit and delete',async()=>{
        await editor.locator('.mw-news-block-title').click();const tools=editor.locator('.mw-news-node-toolbar');await tools.waitFor({state:'visible'});await tools.getByRole('button',{name:'Edit',exact:true}).click();const d=dialog('Edit News Block');await d.waitFor({state:'visible'});await d.locator('#mw-news-title').fill('Updated news');await d.locator('#mw-news-style').selectOption('featured');await d.getByRole('button',{name:'Update',exact:true}).click();await d.waitFor({state:'hidden'});await waitNews('Updated news','/news/fixture','featured');await editor.locator('.mw-news-block-title').click();await tools.getByRole('button',{name:'Delete',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('#html')?.textContent?.includes('data-mw-news-block'))
    })
    await check('News Block unsafe dialog rejection',async()=>{
        await reset();const before=await saved(),d=await open('Insert News Block','Insert news block');await d.locator('#mw-news-title').fill('Test');for(const url of ['javascript:alert(1)','//evil.invalid/news','https://user@evil.invalid/news']){await d.locator('#mw-news-url').fill(url);await d.getByRole('button',{name:'Insert',exact:true}).click();await d.locator('.mw-form-error').waitFor({state:'visible'});assert.equal(await saved(),before)}await d.locator('#mw-news-url').fill('/news/fixture');await d.locator('#mw-news-thumbnail').fill('//evil.invalid/a.png');await d.getByRole('button',{name:'Insert',exact:true}).click();await d.locator('.mw-form-error').waitFor({state:'visible'});assert.equal(await saved(),before);await d.getByRole('button',{name:'Cancel'}).click()
    })
    await check('News Block unsafe metadata rejection',async()=>{
        const bad='<article data-mw-news-block="true" data-title="Safe title" data-url="javascript:alert(1)" data-thumbnail="//evil.invalid/a.png" data-style="card"><h3 data-mw-news-title="true">Safe title</h3></article><p>After</p>'
        const clean=await sanitize(bad);assert.doesNotMatch(clean,/javascript:|evil\.invalid/i);await reset(bad);await editor.locator('.mw-news-block-title').waitFor({state:'visible'});assert.equal(await editor.locator('.mw-news-block img').count(),0);assert.ok(!(await editor.locator('.mw-news-block a').getAttribute('href')??'').includes('javascript:'));await editor.locator(':scope > p:last-child').click();await page.keyboard.press('End');await page.keyboard.insertText(' edited');await page.waitForFunction(()=>document.querySelector('#html')?.textContent?.includes('After edited'));assert.doesNotMatch(await saved(),/javascript:|evil\.invalid/i)
    })
    return {status:'passed',checks}
}
