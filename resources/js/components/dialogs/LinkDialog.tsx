import { useEffect, useState } from 'react'
import { CommandManager, getMarkRange } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'
import type { Editor } from '@tiptap/react'
import { normalizeLinkUrl } from '../../utils/sanitizeHtml'
import Dialog from './Dialog'

interface LinkDialogProps {
    editor: Editor
    open: boolean
    onClose: () => void
}

export function canEditLink(editor: Editor): boolean {
    if (!editor.isEditable || editor.isDestroyed) return false
    const selection = editor.state.selection
    return selection instanceof TextSelection && selection.$from.sameParent(selection.$to)
        && editor.can().setLink({ href: 'https://example.com/' })
}

function captureLinkSelection(editor: Editor) {
    if (!canEditLink(editor)) return null
    const { doc, selection } = editor.state
    const attrs = editor.getAttributes('link')
    const active = editor.isActive('link')
    const range = selection.empty && active ? getMarkRange(selection.$from, editor.schema.marks.link, attrs) : undefined
    const from = range?.from ?? selection.from
    const to = range?.to ?? selection.to
    return { doc, from, to, active, text: doc.textBetween(from, to), href: typeof attrs.href === 'string' ? attrs.href : '', newTab: attrs.target === '_blank' || !attrs.href }
}

export default function LinkDialog({ editor, open, onClose }: LinkDialogProps) {
    const [snapshot, setSnapshot] = useState<ReturnType<typeof captureLinkSelection>>(null)
    const [text, setText] = useState('')
    const [url, setUrl] = useState('')
    const [openInNewTab, setOpenInNewTab] = useState(true)
    const [error, setError] = useState('')
    const linkActive = snapshot?.active ?? false

    useEffect(() => {
        if (!open) { setSnapshot(null); return }
        const captured = captureLinkSelection(editor)
        setSnapshot(captured)
        setText(captured?.text ?? '')
        setUrl(captured?.href ?? '')
        setOpenInNewTab(captured?.newTab ?? true)
        setError(captured ? '' : 'Select editable text before opening the link dialog.')
    }, [open, editor])

    const handleInsert = () => {
        const href = normalizeLinkUrl(url, true)
        if (!href) { setError('Enter an HTTP(S) URL, domain, root-relative path or fragment.'); return }
        if (!snapshot || editor.isDestroyed || !editor.isEditable || editor.state.doc !== snapshot.doc) {
            setError('The document changed. Close and reopen the link dialog.'); return
        }
        const attrs = { href, target: openInNewTab ? '_blank' : null, rel: openInNewTab ? 'noopener noreferrer' : null }
        const range = { from: snapshot.from, to: snapshot.to }
        let applied: boolean
        if (range.from !== range.to) {
            const scratch = new CommandManager({ editor }).createChain(editor.state.tr)
            if (!scratch.setTextSelection(range).setLink(attrs).run()) { setError('Link is unavailable for this selection.'); return }
            applied = editor.chain().focus().setTextSelection(range).setLink(attrs).run()
        } else {
            const content = { type: 'text', text: text.trim() || href, marks: [{ type: 'link', attrs }] }
            if (!editor.can().insertContentAt(range.from, content)) { setError('Link cannot be inserted here.'); return }
            applied = editor.chain().focus().insertContentAt(range.from, content).run()
        }
        if (!applied) { setError('Link command was not applied.'); return }
        onClose()
    }

    const handleRemove = () => {
        if (!snapshot || editor.isDestroyed || !editor.isEditable || editor.state.doc !== snapshot.doc) {
            setError('The document changed. Close and reopen the link dialog.'); return
        }
        const range = { from: snapshot.from, to: snapshot.to }
        const scratch = new CommandManager({ editor }).createChain(editor.state.tr)
        if (!scratch.setTextSelection(range).unsetLink().run()) { setError('Link cannot be removed.'); return }
        if (editor.chain().focus().setTextSelection(range).unsetLink().run()) onClose()
        else setError('Link command was not applied.')
    }

    return (
        <Dialog
            open={open}
            onClose={onClose}
            title={
                linkActive
                    ? 'Edit Link'
                    : 'Insert Link'
            }
            description="Link selected text without replacing its formatting, or insert new linked text at the cursor."
        >
            <div className="mw-dialog-body">
                <div className="mw-form-group">
                    <label
                        className="mw-form-label"
                        htmlFor="mw-link-text"
                    >
                        Text
                    </label>

                    <input
                        id="mw-link-text"
                        type="text"
                        className="mw-form-input"
                        value={text}
                        readOnly={!!snapshot && snapshot.from !== snapshot.to}
                        onChange={(event) =>
                            setText(
                                event.target.value
                            )
                        }
                        placeholder="Link text"
                    />
                </div>

                <div className="mw-form-group">
                    <label
                        className="mw-form-label"
                        htmlFor="mw-link-url"
                    >
                        URL
                    </label>

                    <input
                        id="mw-link-url"
                        type="text"
                        className="mw-form-input"
                        value={url}
                        onChange={(event) => {
                            setUrl(
                                event.target.value
                            )

                            setError('')
                        }}
                        placeholder="https://example.com"
                        autoFocus
                    />

                    {error && (
                        <p className="mw-form-error">
                            {error}
                        </p>
                    )}
                </div>

                <label className="mw-checkbox-row">
                    <input
                        type="checkbox"
                        checked={
                            openInNewTab
                        }
                        onChange={(event) =>
                            setOpenInNewTab(
                                event.target
                                    .checked
                            )
                        }
                    />

                    <span>
                        Open in new tab
                    </span>
                </label>
            </div>

            <div className="mw-dialog-footer">
                <div>
                    {linkActive && (
                        <button
                            type="button"
                            className="mw-dialog-button mw-dialog-button-danger"
                            onClick={
                                handleRemove
                            }
                        >
                            Remove Link
                        </button>
                    )}
                </div>

                <div className="mw-dialog-footer-actions">
                    <button
                        type="button"
                        className="mw-dialog-button"
                        onClick={
                            onClose
                        }
                    >
                        Cancel
                    </button>

                    <button
                        type="button"
                        className="mw-dialog-button mw-dialog-button-primary"
                        disabled={!snapshot}
                        onClick={
                            handleInsert
                        }
                    >
                        {linkActive
                            ? 'Update'
                            : 'Insert'}
                    </button>
                </div>
            </div>
        </Dialog>
    )
}