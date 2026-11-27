import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import { chromium } from 'playwright'
import evidence from './browser-evidence.cjs'
const {EXPECTED,TOTAL,verifySuite,verifyBrowserEvidence}=evidence
import { runFormatting } from './formatting.mjs'
import { runBlocks } from './blocks.mjs'
import { runLists } from './lists.mjs'
import { runLinksTypography } from './links-typography.mjs'
import { runHistory } from './history.mjs'
import { runSynchronization } from './synchronization.mjs'
import { runMedia, serveMedia } from './media.mjs'
const [expected,report] = process.argv.slice(2)
assert.match(expected,/^(18|19)\.\d+\.\d+$/)
assert.ok(report)
const root=path.resolve('dist'), files=fs.readdirSync(path.join(root,'assets'))
const allowed=new Map([['/',path.join(root,'index.html')],...files.map(n=>['/assets/'+n,path.join(root,'assets',n)])])
const mediaRequests=[]
const server=http.createServer((req,res)=>{
    if(serveMedia(req,res,mediaRequests))return
    const file=allowed.get(req.url)
    if(!file){res.writeHead(404).end();return}
    const type={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'}[path.extname(file)] || 'application/octet-stream'
    res.writeHead(200,{'Content-Type':type});res.end(fs.readFileSync(file))
})
let browser,page,stage='server'
const errors=[], warnings=[], unexpected=[], completed={}, timingsMs={}
const started=performance.now()
const write=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n',{flag:'wx'})
async function suite(name,execute){
    stage=name;const start=performance.now()
    console.log('Browser suite started: '+name)
    const result=await execute()
    verifySuite(name,result)
    completed[name]=result;timingsMs[name]=Math.round(performance.now()-start)
    console.log('Browser suite passed: '+name+' ('+result.checks.length+' groups)')
    return result
}
try {
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)})
    const origin=`http://127.0.0.1:${server.address().port}`
    stage='launch'
    browser=await chromium.launch({headless:true})
    page=await browser.newPage()
    stage='smoke';const smokeStart=performance.now()
    page.on('pageerror',e=>errors.push(e.message))
    page.on('console',m=>{
        // The one intentional 422 fixture is asserted in the media suite.
        const expected422=m.location().url===origin+'/__media/reject' && /Failed to load resource: the server responded with a status of 422/.test(m.text())
        if(m.type()==='error'&&!expected422)errors.push(m.text());if(m.type()==='warning')warnings.push(m.text())
    })
    page.on('response',r=>{if(r.status()>=400&&!(r.status()===422&&r.url()===origin+'/__media/reject'))errors.push(`${r.status()} ${r.url()}`)})
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
    completed.smoke={status:'pending-final-check',checks:EXPECTED.smoke.slice(0,-1)};timingsMs.smoke=Math.round(performance.now()-smokeStart)
    const formatting=await suite('formatting',()=>runFormatting(page,editor))
    const blocks=await suite('blocks',()=>runBlocks(page,editor))
    const lists=await suite('lists',()=>runLists(page,editor))
    const linksTypography=await suite('linksTypography',()=>runLinksTypography(page,editor))
    const history=await suite('history',()=>runHistory(page,editor))
    const synchronization=await suite('synchronization',()=>runSynchronization(page))
    const media=await suite('media',()=>runMedia(page,origin,mediaRequests))
    stage='final-evidence'
    assert.deepEqual(errors,[],'Browser errors');assert.deepEqual(unexpected,[],'Unexpected network requests')
    completed.smoke={status:'passed',checks:[...EXPECTED.smoke]}
    const summary={schema:1,status:'passed',react:expected,chromium:browser.version(),checks:completed.smoke.checks,formatting,blocks,lists,linksTypography,history,synchronization,media,warnings,errors,unexpected,totalChecks:TOTAL,timingsMs}
    verifyBrowserEvidence(summary,expected)
    write(report,summary)
    console.log('Browser consumer smoke passed: React '+expected)
} catch(error) {
    // Only synthetic consumer fixtures are captured. Do not let diagnostic failure mask the original error.
    const diagnostic={schema:1,status:'failed',react:expected,stage,completed,timingsMs,elapsedMs:Math.round(performance.now()-started),error:String(error.stack||error).slice(0,16000),warnings,errors,unexpected,chromium:browser?.version()??null}
    if(page&&!page.isClosed()){
        try{await page.screenshot({path:path.join(path.dirname(report),'browser-failure.png'),timeout:5000});diagnostic.screenshot='browser-failure.png'}catch(e){diagnostic.screenshotError=String(e.message||e).slice(0,1000)}
    }
    try{write(path.join(path.dirname(report),'browser-failure.json'),diagnostic)}catch(e){console.error('Failure evidence write failed: '+e.message)}
    throw error
} finally {
    try {if(browser)await browser.close()} finally {await new Promise(resolve=>server.close(resolve))}
}
