import assert from 'node:assert/strict'
import { selectBlocks } from './blocks.mjs'

export const expectedLinkTypographyChecks = ['selected link insertion and editing','cursor link insertion','link removal and cancel','unsafe link rejection','relative and fragment links','host change rejects stale link selection','automatic bare host link','text color round trip','font size round trip','font family round trip','combined typography and clear','selection-only typography state','unsafe typography sanitization']

export async function runLinksTypography(page, editor) {
    const checks=[]
    const toolbar=page.getByRole('toolbar',{name:'Text formatting controls'})
    const button=name=>toolbar.getByRole('button',{name,exact:true})
    const dialog=page.getByRole('dialog')
    const url=page.locator('#mw-link-url'), textField=page.locator('#mw-link-text')
    async function reset(html,text) {
        const before=Number(await page.locator('#format-generation').textContent())
        await page.locator('#format-source').fill(html);await page.locator('#format-reset').click()
        await page.waitForFunction(({before,text})=>Number(document.querySelector('#format-generation')?.textContent)===before+1&&document.querySelector('.mw-tiptap-content[contenteditable="true"]')?.textContent===text&&document.querySelector('#changes')?.textContent==='0',{before,text})
        await editor.waitFor({state:'visible'})
    }
    async function openLink(){await button('Insert or Edit Link').click();await dialog.waitFor({state:'visible'});await url.waitFor({state:'visible'});await page.waitForFunction(()=>{const b=document.querySelector('.mw-dialog-button-primary');return b&&!b.disabled})}
    async function submit(label){await dialog.getByRole('button',{name:label,exact:true}).click();await dialog.waitFor({state:'hidden'})}
    async function contentState(expected) {
        await page.waitForFunction(expected=>{
            const live=document.querySelector('.mw-tiptap-content[contenteditable="true"]'), saved=document.querySelector('#html')?.textContent
            if(!live||typeof saved!=='string'||Number(document.querySelector('#changes')?.textContent)<=0)return false
            return [live,new DOMParser().parseFromString(saved,'text/html').body].every(root=>{
                if(root.children.length!==1||root.firstElementChild?.tagName!=='P'||root.textContent!==expected.text)return false
                const p=root.firstElementChild, a=p.querySelector('a')
                if(expected.href!==undefined){if(p.querySelectorAll('a').length!==1||a.getAttribute('href')!==expected.href||a.textContent!==expected.linkText)return false
                    if(expected.blank!==undefined&&(a.getAttribute('target')==='_blank')!==expected.blank)return false
                    if(expected.blank&&!['noopener','noreferrer'].every(t=>(a.getAttribute('rel')??'').split(/\s+/).includes(t)))return false
                }else if(a)return false
                if(expected.bold!==undefined&&(p.querySelector('strong')?.textContent??'')!==expected.bold)return false
                const walker=document.createTreeWalker(p,NodeFilter.SHOW_TEXT);let n,found=false
                while((n=walker.nextNode())){if(!n.textContent)continue;found=true
                    const actual={color:'',fontSize:'',fontFamily:''}
                    for(let e=n.parentElement;e&&e!==p;e=e.parentElement){for(const key of Object.keys(actual))if(!actual[key]&&e.style?.[key])actual[key]=e.style[key]}
                    if(Object.keys(actual).some(key=>actual[key]!== (expected[key]??'')))return false
                }
                return found
            })
        },expected)
    }
    async function change(name,value){await toolbar.getByRole('combobox',{name,exact:true}).selectOption(value)}
    async function check(name,fn){try{await fn();checks.push(name);console.log('Link/typography passed: '+name)}catch(e){try{console.error('Link/typography diagnostics: '+JSON.stringify(await page.evaluate(()=>({html:document.querySelector('.mw-tiptap-content')?.innerHTML,saved:document.querySelector('#html')?.textContent,changes:document.querySelector('#changes')?.textContent,selection:getSelection()?.toString(),focus:document.activeElement?.outerHTML.slice(0,300),dialog:document.querySelector('.mw-dialog')?.innerText,selects:[...document.querySelectorAll('select')].map(s=>({label:s.getAttribute('aria-label'),value:s.value,disabled:s.disabled}))}))))}catch{}throw Error('Link/typography failed: '+name+' — '+e.message,{cause:e})}}
    await check('selected link insertion and editing',async()=>{
        await reset('<p><strong>Link target</strong></p>','Link target');await selectBlocks(editor,'p','p',true);await openLink()
        assert.equal(await textField.inputValue(),'Link target');assert.equal(await textField.getAttribute('readonly'),'');await url.fill('example.com');await submit('Insert');await contentState({text:'Link target',href:'https://example.com/',linkText:'Link target',bold:'Link target',blank:true})
        await selectBlocks(editor,'p');await openLink();assert.equal(await url.inputValue(),'https://example.com/');await url.fill('https://example.org/new');await dialog.getByRole('checkbox').uncheck();await submit('Update');await contentState({text:'Link target',href:'https://example.org/new',linkText:'Link target',bold:'Link target',blank:false})
    })
    await check('cursor link insertion',async()=>{
        await reset('<p>AB</p>','AB');await selectBlocks(editor,'p');await openLink();await textField.fill('New');await url.fill('https://example.com/new');await submit('Insert');await contentState({text:'ANewB',href:'https://example.com/new',linkText:'New',blank:true})
    })
    await check('link removal and cancel',async()=>{
        const source='<p><a href="https://example.com/">Linked</a></p>';await reset(source,'Linked');await selectBlocks(editor,'p');await openLink();await url.fill('https://example.org/');await submit('Cancel');assert.equal(await page.locator('#changes').textContent(),'0');assert.equal(await page.locator('#html').textContent(),source)
        await selectBlocks(editor,'p');await button('Remove Link').click();await contentState({text:'Linked'})
    })
    await check('unsafe link rejection',async()=>{
        await reset('<p>Target</p>','Target');await selectBlocks(editor,'p','p',true);await openLink()
        for(const value of ['javascript:alert(1)','data:text/html,bad','//example.com','https://user@example.com','mailto:a@example.com','https://example.com\\bad']){
            await url.fill(value);await dialog.getByRole('button',{name:'Insert',exact:true}).click();await dialog.locator('.mw-form-error').waitFor({state:'visible'});assert.equal(await page.locator('#changes').textContent(),'0')
        }
        await submit('Cancel');assert.equal(await editor.innerText(),'Target')
    })
    await check('relative and fragment links',async()=>{
        for(const href of ['/articles/one','#section']){await reset('<p>Target</p>','Target');await selectBlocks(editor,'p','p',true);await openLink();await url.fill(href);await submit('Insert');await contentState({text:'Target',href,linkText:'Target',blank:true})}
    })
    await check('host change rejects stale link selection',async()=>{
        await reset('<p>Original</p>','Original');await selectBlocks(editor,'p','p',true);await openLink();await url.fill('https://example.com/')
        // Simulate a host-controlled value update without replacing the editor instance.
        await page.locator('#host-replace').evaluate(button=>button.click())
        await page.waitForFunction(()=>document.querySelector('.mw-tiptap-content')?.textContent==='Host replaced')
        await dialog.getByRole('button',{name:'Insert',exact:true}).click();await dialog.locator('.mw-form-error').waitFor({state:'visible'});assert.match(await dialog.locator('.mw-form-error').innerText(),/document changed/i)
        assert.equal(await page.locator('#changes').textContent(),'0');assert.equal(await page.locator('#html').textContent(),'<p>Host replaced</p>');await submit('Cancel')
    })
    await check('automatic bare host link',async()=>{
        await reset('<p>AB</p>','AB');await selectBlocks(editor,'p');await page.keyboard.insertText(' example.com ')
        await page.waitForFunction(()=>{
            const live=document.querySelector('.mw-tiptap-content'),saved=new DOMParser().parseFromString(document.querySelector('#html')?.textContent??'','text/html').body
            return [live,saved].every(root=>root?.textContent==='A example.com B'&&root.querySelector('a')?.textContent==='example.com'&&new URL(root.querySelector('a').getAttribute('href')).href==='https://example.com/')
        })
    })
    for(const [name,label,key,value] of [['text color round trip','Text color','color','red'],['font size round trip','Font size','fontSize','20px'],['font family round trip','Font family','fontFamily','serif']])await check(name,async()=>{
        await reset('<p><strong>Styled</strong></p>','Styled');await selectBlocks(editor,'p','p',true);await change(label,value);await contentState({text:'Styled',bold:'Styled',[key]:value});await selectBlocks(editor,'p','p',true);await change(label,'default');await contentState({text:'Styled',bold:'Styled'})
    })
    await check('combined typography and clear',async()=>{
        await reset('<p>Styled</p>','Styled');for(const [label,value] of [['Text color','blue'],['Font size','24px'],['Font family','monospace']]){await selectBlocks(editor,'p','p',true);await change(label,value)}await contentState({text:'Styled',color:'blue',fontSize:'24px',fontFamily:'monospace'});const saved=await page.locator('#html').textContent();await reset(saved,'Styled');await selectBlocks(editor,'p','p',true);await button('Clear Formatting').click();await contentState({text:'Styled'})
    })
    await check('selection-only typography state',async()=>{
        const source='<p><span style="color: red; font-size: 20px; font-family: serif">Styled</span></p><p>Plain</p>';await reset(source,'StyledPlain');const initial=await editor.innerHTML();await selectBlocks(editor,'p:first-child');for(const [name,value] of [['Text color','red'],['Font size','20px'],['Font family','serif']])await page.waitForFunction(({name,value})=>[...document.querySelectorAll('select')].find(s=>s.getAttribute('aria-label')===name)?.value===value,{name,value});await selectBlocks(editor,'p:last-child');for(const name of ['Text color','Font size','Font family'])await page.waitForFunction(name=>[...document.querySelectorAll('select')].find(s=>s.getAttribute('aria-label')===name)?.value==='',name);assert.equal(await page.locator('#changes').textContent(),'0');assert.equal(await editor.innerHTML(),initial);assert.equal(await page.locator('#html').textContent(),source)
    })
    await check('unsafe typography sanitization',async()=>{
        await reset('<p><span style="font-size: 999px; font-family: RemoteFont">AB</span></p>','AB');await selectBlocks(editor,'p');await page.keyboard.insertText('Z');await contentState({text:'AZB'})
    })
    assert.deepEqual(checks,expectedLinkTypographyChecks);return {status:'passed',checks}
}
