import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import DefaultEditor, { TiptapEditor, sanitizeEditorHtml, createEditorExtensions, type TiptapEditorProps } from '@microweb/laravel-tiptap-editor'
import '@microweb/laravel-tiptap-editor/editor.css'

if (DefaultEditor !== TiptapEditor) throw new Error('Default and named exports differ')
const clean = sanitizeEditorHtml('<p>Safe <strong>text</strong></p><script>bad()</script>')
if (clean !== '<p>Safe <strong>text</strong></p>') throw new Error('Unexpected sanitizer smoke result: ' + clean)
const extensions = createEditorExtensions()
if (!Array.isArray(extensions) || extensions.length < 5) throw new Error('Extension factory failed')

function App() {
    const [value, setValue] = useState('<p>Consumer smoke</p>')
    const [changes, setChanges] = useState(0)
    const [mode, setMode] = useState<'named'|'default'|'hidden'>('named')
    const props: TiptapEditorProps = {value, minHeight: 240, onChange: html => {setValue(html);setChanges(c=>c+1)}}
    return <main>
        <div id="react-version">{React.version}</div>
        <button id="hide" onClick={()=>setMode('hidden')}>Unmount editor</button>
        <button id="show-default" onClick={()=>setMode('default')}>Mount default editor</button>
        <output id="changes">{changes}</output><pre id="html">{value}</pre>
        {mode==='named' ? <TiptapEditor key="named" {...props}/> : mode==='default' ? <DefaultEditor key="default" {...props}/> : null}
    </main>
}
createRoot(document.getElementById('root')!).render(<App/>)
