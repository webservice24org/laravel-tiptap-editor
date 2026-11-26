import { useEditorState, type Editor } from '@tiptap/react'

type BlockFormat = 'paragraph' | 'h1' | 'h2' | 'h3'

interface FormatDropdownProps {
    editor: Editor
    disabled?: boolean
}

function getCurrentFormat(editor: Editor): BlockFormat | 'other' {
    if (editor.isActive('heading', { level: 1 })) return 'h1'
    if (editor.isActive('heading', { level: 2 })) return 'h2'
    if (editor.isActive('heading', { level: 3 })) return 'h3'
    if (editor.isActive('paragraph')) return 'paragraph'
    return 'other'
}

function canSetFormat(editor: Editor, value: BlockFormat): boolean {
    if (!editor.isEditable || editor.isDestroyed) return false
    if (value === 'paragraph') return editor.can().setParagraph()
    const level = value === 'h1' ? 1 : value === 'h2' ? 2 : 3
    return editor.can().setHeading({ level })
}

function applyBlockFormat(editor: Editor, value: BlockFormat): boolean {
    if (!canSetFormat(editor, value)) return false
    if (value === 'paragraph') return editor.chain().focus().setParagraph().run()
    const level = value === 'h1' ? 1 : value === 'h2' ? 2 : 3
    return editor.chain().focus().setHeading({ level }).run()
}

export default function FormatDropdown({ editor, disabled = false }: FormatDropdownProps) {
    const format = useEditorState({
        editor,
        selector: ({ editor: currentEditor }) => ({
            value: getCurrentFormat(currentEditor),
            paragraph: canSetFormat(currentEditor, 'paragraph'),
            h1: canSetFormat(currentEditor, 'h1'),
            h2: canSetFormat(currentEditor, 'h2'),
            h3: canSetFormat(currentEditor, 'h3'),
        }),
    })
    const handleChange = (value: string) => {
        if (disabled) return
        if (value === 'paragraph' || value === 'h1' || value === 'h2' || value === 'h3') {
            applyBlockFormat(editor, value)
        }
    }
    return (
        <select
            className="mw-tiptap-format-select"
            value={format.value}
            disabled={disabled || !(format.paragraph || format.h1 || format.h2 || format.h3)}
            onChange={event => handleChange(event.target.value)}
            aria-label="Text format"
        >
            <option value="other" disabled>Other / mixed</option>
            <option value="paragraph" disabled={!format.paragraph}>Paragraph</option>
            <option value="h1" disabled={!format.h1}>Heading 1</option>
            <option value="h2" disabled={!format.h2}>Heading 2</option>
            <option value="h3" disabled={!format.h3}>Heading 3</option>
        </select>
    )
}
