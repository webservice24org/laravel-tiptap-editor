import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import { chromium } from 'playwright'
import { runFormatting } from './formatting.mjs'
import { runBlocks } from './blocks.mjs'
import { runLists } from './lists.mjs'
import { runLinksTypography } from './links-typography.mjs'
import { runHistory } from './history.mjs'
const [expected,report] = process.argv.slice(2)
assert.match(expected,/^(18|19)\.\d+\.\d+$/)
assert.ok(report)
const root=path.resolve('dist'), files=fs.readdirSync(path.join(root,'assets'))
const allowed=new Map([['/',path.join(root,'index.html')],...files.map(n=>['/assets/'+n,path.join(root,'assets',n)])])
const server=http.createServer((req,res)=>{
    const file=allowed.get(req.url)
    if(!file){res.writeHead(404).end();return}
    const type={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'}[path.extname(file)] || 'application/octet-stream'
    res.writeHead(200,{'Content-Type':type});res.end(fs.readFileSync(file))
})
let browser
try {
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)})
    const origin=`http://127.0.0.1:${server.address().port}`
    browser=await chromium.launch({headless:true})
    const page=await browser.newPage()
    const errors=[], warnings=[], unexpected=[]
    page.on('pageerror',e=>errors.push(e.message))
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text())})
    page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`)})
    await page.route('**/*',route=>{if(new URL(route.request().url()).origin!==origin){unexpected.push(route.request().url());return route.abort()}return route.continue()})
    await page.goto(origin,{waitUntil:'load'})
    const editor=page.locator('.mw-tiptap-content[contenteditable="true"]')
    await editor.waitFor({state:'visible',timeout:15000})
    assert.equal(await page.locator('#react-version').textContent(),expected)
    assert.equal(await editor.innerText(),'Consumer smoke')
    assert.equal(await page.locator('.mw-tiptap-editor').evaluate(e=>getComputedStyle(e).borderTopStyle),'solid')
    assert.equal(await page.locator('.mw-tiptap-editor').evaluate(e=>getComputedStyle(e).borderTopWidth),'1px')
    assert.equal(await editor.evaluate(e=>getComputedStyle(e).minHeight),'240px')
    await editor.click();await page.keyboard.press('End');await page.keyboard.insertText(' edited')
    await page.waitForFunction(()=>document.querySelector('#html')?.textContent?.includes('Consumer smoke edited'))
    assert.ok(Number(await page.locator('#changes').textContent())>0,'onChange not called')
    await page.locator('#hide').click();await editor.waitFor({state:'detached'})
    await page.locator('#show-default').click();await editor.waitFor({state:'visible'})
    assert.equal(await editor.innerText(),'Consumer smoke edited')
    const formatting=await runFormatting(page,editor)
    const blocks=await runBlocks(page,editor)
    const lists=await runLists(page,editor)
    const linksTypography=await runLinksTypography(page,editor)
    const history=await runHistory(page,editor)
    assert.deepEqual(errors,[],'Browser errors');assert.deepEqual(unexpected,[],'Unexpected network requests')
    fs.writeFileSync(report,JSON.stringify({status:'passed',react:expected,chromium:browser.version(),checks:['named mount','React version','CSS applied','minHeight','edit callback','unmount','default remount','sanitizer and extension factory','no page errors or remote requests'],formatting,blocks,lists,linksTypography,history,warnings},null,2)+'\n',{flag:'wx'})
    console.log('Browser consumer smoke passed: React '+expected)
} finally {
    try {if(browser)await browser.close()} finally {await new Promise(resolve=>server.close(resolve))}
}
