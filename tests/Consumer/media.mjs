import assert from 'node:assert/strict'

// Synthetic transport only. PHP Testbench tests exercise the real storage,
// authorization, content inspection, finalization and cleanup separately.
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAFAAAAAoCAIAAADmAupWAAAATklEQVR4nO3PAQ3AIADAMEAJCtGE1Lv4k71VsM197viT9XXA2wzXGa4zXGe4znCd4TrDdYbrDNcZrjNcZ7jOcJ3hOsN1husM1xmuM1z3AHQqAX6ohHbIAAAAAElFTkSuQmCC','base64')
const first='editor/tmp/fixture-owner/first.png', second='editor/tmp/fixture-owner/second.png'
const file=name=>({name,mimeType:'image/png',buffer:png})
// Real loopback HTTP transport, synthetic responses only; never contact Laravel
// or inspect host media. Capture actual multipart bytes on the server rather
// than CDP request metadata, which can omit file parts.
export function serveMedia(req,res,requests){
    if(['/storage/'+first,'/storage/'+second,'/__media/custom.png','/__media/direct.png'].includes(req.url)&&req.method==='GET'){
        res.writeHead(200,{'Content-Type':'image/png','Cache-Control':'no-store'});res.end(png);return true
    }
    const endpoint=req.url
    if(!['/tiptap-editor/media','/__media/upload','/__media/invalid','/__media/reject'].includes(endpoint))return false
    if(req.method!=='POST'){res.writeHead(405).end();return true}
    const chunks=[];let size=0
    req.on('data',chunk=>{size+=chunk.length;if(size<=65536)chunks.push(chunk)})
    req.on('end',()=>{
        if(size>65536){res.writeHead(413).end();return}
        const body=Buffer.concat(chunks);requests.push({endpoint,method:req.method,headers:req.headers,body})
        const path=body.includes(Buffer.from('filename="second.png"'))?second:first
        const status=endpoint==='/__media/reject'?422:200
        const data=endpoint==='/__media/reject'?{message:'Fixture image rejected'}:endpoint==='/__media/invalid'?{url:'https://example.invalid/image.png',path:123}:{url:'/storage/'+path,path,temporary:true}
        res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data))
    })
    return true
}
export async function runMedia(page,origin,requests){
    const checks=[]
    const primary=page.locator('#primary-editor'), editor=primary.locator('.mw-tiptap-content[contenteditable="true"]')
    const dialog=page.getByRole('dialog',{name:'Insert Image'})
    const image=editor.locator('.mw-image-node img')
    const add=primary.getByRole('button',{name:'Add image',exact:true})
    const saved=()=>page.locator('#html').textContent()
    const check=async(name,fn)=>{await fn();checks.push(name);console.log('Media check passed: '+name)}
    const reset=async(mode='default',html='<p>Image target</p>')=>{
        const generation=Number(await page.locator('#format-generation').textContent())
        await page.locator('#upload-mode').selectOption(mode)
        await page.locator('#format-source').fill(html)
        await page.locator('#format-reset').click()
        await page.waitForFunction(n=>Number(document.querySelector('#format-generation')?.textContent)===n+1&&document.querySelector('#changes')?.textContent==='0',generation)
        await editor.waitFor({state:'visible'})
    }
    const open=async()=>{await add.click();await dialog.waitFor({state:'visible'})}
    const upload=async(name='first.png')=>{await open();await dialog.locator('input[type=file]').setInputFiles(file(name))}
    const insert=()=>dialog.getByRole('button',{name:'Insert',exact:true}).click()
    const cancel=()=>dialog.getByRole('button',{name:'Cancel',exact:true}).click()
    const waitSaved=async(src,path,alt,caption)=>{
        await page.waitForFunction(({src,path,alt,caption})=>{
            const h=new DOMParser().parseFromString(document.querySelector('#html')?.textContent??'','text/html')
            const f=h.querySelector('figure[data-mw-image]'),i=f?.querySelector('img')
            return !!f&&i?.getAttribute('src')===src&&(f.getAttribute('data-mw-path')??'')===path&&i.getAttribute('alt')===alt&&(f.querySelector('figcaption')?.textContent??'')===caption
        },{src,path,alt,caption})
        await image.waitFor({state:'visible'})
        assert.equal(await image.getAttribute('src'),src)
    }
    const noMutation=async(before,requestCount)=>{assert.equal(await saved(),before);assert.equal(await image.count(),0);assert.equal(requests.length,requestCount)}
    const expectError=async(text)=>{await dialog.locator('.mw-form-error').waitFor({state:'visible'});assert.match(await dialog.locator('.mw-form-error').textContent(),text)}
    await page.evaluate(()=>{const meta=document.createElement('meta');meta.name='csrf-token';meta.content='synthetic-csrf';document.head.append(meta)})
    try {
        await check('default upload multipart and managed metadata',async()=>{
            await reset();await upload();await dialog.locator('#mw-image-alt').fill('বাংলা ALT');await dialog.locator('#mw-image-caption').fill('Caption বাংলা');await insert()
            await dialog.waitFor({state:'hidden'});await waitSaved('/storage/'+first,first,'বাংলা ALT','Caption বাংলা')
            assert.equal(requests.length,1);const r=requests[0];assert.equal(r.endpoint,'/tiptap-editor/media');assert.equal(r.method,'POST');assert.equal(r.headers['x-csrf-token'],'synthetic-csrf');assert.equal(r.headers.accept,'application/json');assert.match(r.headers['content-type'],/^multipart\/form-data; boundary=/);assert.ok(r.body.includes(Buffer.from('name="image"; filename="first.png"')));assert.ok(r.body.includes(png))
        })
        await check('managed image remount and persisted metadata',async()=>{
            const html=await saved();await reset('default',html);await waitSaved('/storage/'+first,first,'বাংলা ALT','Caption বাংলা');assert.equal(requests.length,1)
        })
        await check('image replacement preserves caption and alt',async()=>{
            await image.click();const toolbar=editor.locator('.mw-image-node-toolbar');await toolbar.waitFor({state:'visible'});
            await toolbar.getByTitle('Align left',{exact:true}).click();await page.waitForFunction(()=>document.querySelector('#html')?.textContent?.includes('data-align="left"'))
            const handle=editor.locator('.mw-image-resize-handle-bottom-right');await handle.scrollIntoViewIfNeeded();const box=await handle.boundingBox(),bounds=await editor.boundingBox();assert.ok(box&&bounds)
            await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2-bounds.width*0.35,box.y+box.height/2,{steps:6});await page.mouse.up()
            await page.waitForFunction(()=>{const f=new DOMParser().parseFromString(document.querySelector('#html')?.textContent??'','text/html').querySelector('figure[data-mw-image]');const w=Number(f?.getAttribute('data-width'));return w>=50&&w<=80&&f.getAttribute('data-wrap')==='true'})
            const width=(await saved()).match(/data-width="(\d+)"/)[1]
            await toolbar.locator('input[type=file]').setInputFiles(file('second.png'));await waitSaved('/storage/'+second,second,'বাংলা ALT','Caption বাংলা');assert.match(await saved(),/data-align="left"/);assert.ok((await saved()).includes(`data-width="${width}"`));assert.ok((await saved()).includes('data-wrap="true"'));assert.equal(requests.length,2);assert.equal((await saved()).includes(first),false)
        })
        await check('image deletion is document-only',async()=>{
            await image.click();await editor.getByTitle('Delete image',{exact:true}).click();await image.waitFor({state:'detached'});await page.waitForFunction(()=>!document.querySelector('#html')?.textContent?.includes('data-mw-image'));assert.equal(requests.length,2)
        })
        await check('alternate same-origin endpoint',async()=>{
            await reset('alternate');await upload();await insert();await dialog.waitFor({state:'hidden'});await waitSaved('/storage/'+first,first,'','');assert.equal(requests.length,3);assert.equal(requests[2].endpoint,'/__media/upload');assert.equal(requests[2].headers['x-csrf-token'],'synthetic-csrf')
        })
        await check('direct URL and cancelled file remain unmanaged',async()=>{
            await reset();const before=await saved();await upload();await cancel();await dialog.waitFor({state:'hidden'});await noMutation(before,3);await open();await dialog.locator('#mw-image-url').fill('/__media/direct.png');await insert();await dialog.waitFor({state:'hidden'});await waitSaved('/__media/direct.png','','','');assert.equal(requests.length,3)
        })
        await check('HTTP validation rejection leaves document unchanged',async()=>{
            await reset('reject');const before=await saved();await upload();const response=page.waitForResponse(r=>r.url()===origin+'/__media/reject');await insert();assert.equal((await response).status(),422);await expectError(/Fixture image rejected/);await noMutation(before,4);await cancel()
        })
        await check('malformed response and cross-origin endpoint rejected',async()=>{
            await reset('invalid');const before=await saved();await upload();await insert();await expectError(/Invalid image upload path/);await noMutation(before,5);await cancel();await reset('cross');const other=await saved();await upload();await insert();await expectError(/same-origin/);await noMutation(other,5);await cancel()
        })
        await check('host callback success and rejection without built-in request',async()=>{
            await reset('callback');const before=await saved();await upload('reject.png');await insert();await expectError(/Host rejected fixture/);await noMutation(before,5);await cancel();await upload('invalid.png');await insert();await expectError(/invalid URL/);await noMutation(before,5);await cancel();await upload();await insert();await dialog.waitFor({state:'hidden'});await waitSaved('/__media/custom.png','','','');assert.equal(requests.length,5)
        })
        await check('unsafe image URL rejected before preview or insertion',async()=>{
            await reset();const before=await saved();await open();for(const url of ['javascript:alert(1)','data:image/svg+xml;base64,AAAA','//example.invalid/unsafe.png','https://user:pass@example.invalid/unsafe.png']){await dialog.locator('#mw-image-url').fill(url);assert.equal(await dialog.locator('.mw-image-preview-panel img').count(),0);await insert();await expectError(/valid image URL/);await noMutation(before,5)}await cancel()
        })
        return {status:'passed',checks}
    } finally {
        await page.evaluate(()=>document.querySelector('meta[name="csrf-token"]')?.remove())
    }
}
