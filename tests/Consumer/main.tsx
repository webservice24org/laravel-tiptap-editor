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
    const [fixtureHtml, setFixtureHtml] = useState('<p>Format target</p>')
    const [generation, setGeneration] = useState(0)
    const [mode, setMode] = useState<'named'|'default'|'hidden'>('named')
    const [secondaryOpen, setSecondaryOpen] = useState(false)
    const [secondaryValue, setSecondaryValue] = useState('<p>Other editor</p>')
    const [secondaryChanges, setSecondaryChanges] = useState(0)
    const props: TiptapEditorProps = {value, minHeight: 240, onChange: html => {setValue(html);setChanges(c=>c+1)}}
    return <main>
        <div id="react-version">{React.version}</div>
        <button id="host-replace" onClick={()=>setValue('<p>Host replaced</p>')}>Replace host value</button>
        <button id="hide" onClick={()=>setMode('hidden')}>Unmount editor</button>
        <button id="show-default" onClick={()=>setMode('default')}>Mount default editor</button>
        <label htmlFor="format-source">Formatting test source</label>
        <input id="format-source" value={fixtureHtml} onChange={event=>setFixtureHtml(event.target.value)} />
        <button id="format-reset" onClick={()=>{setValue(fixtureHtml);setChanges(0);setMode('named');setGeneration(n=>n+1)}}>Reset formatting fixture</button>
        <label htmlFor="history-host-input">Independent host history input</label>
        <input id="history-host-input" defaultValue="Host" />
        <output id="format-generation">{generation}</output>
        <output id="changes">{changes}</output><pre id="html">{value}</pre>
        <section id="primary-editor">
            {mode==='named' ? <TiptapEditor key={`named-${generation}`} {...props}/> : mode==='default' ? <DefaultEditor key={`default-${generation}`} {...props}/> : null}
        </section>
        <button id="toggle-secondary" onClick={()=>setSecondaryOpen(open=>!open)}>Toggle independent editor</button>
        {secondaryOpen && <section id="secondary-editor">
            <output id="secondary-changes">{secondaryChanges}</output><pre id="secondary-html">{secondaryValue}</pre>
            <TiptapEditor value={secondaryValue} minHeight={240} onChange={html=>{setSecondaryValue(html);setSecondaryChanges(n=>n+1)}} />
        </section>}
    </main>
}
createRoot(document.getElementById('root')!).render(<App/>)
