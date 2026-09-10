import type {
    Editor,
} from '@tiptap/react'

interface FormatDropdownProps {
    editor: Editor
}

export default function FormatDropdown({
    editor,
}: FormatDropdownProps) {
    const getCurrentFormat = () => {
        if (
            editor.isActive('heading', {
                level: 1,
            })
        ) {
            return 'h1'
        }

        if (
            editor.isActive('heading', {
                level: 2,
            })
        ) {
            return 'h2'
        }

        if (
            editor.isActive('heading', {
                level: 3,
            })
        ) {
            return 'h3'
        }

        return 'paragraph'
    }

    const handleChange = (
        value: string
    ) => {
        if (value === 'paragraph') {
            editor
                .chain()
                .focus()
                .setParagraph()
                .run()

            return
        }

        if (value === 'h1') {
            editor
                .chain()
                .focus()
                .setHeading({
                    level: 1,
                })
                .run()

            return
        }

        if (value === 'h2') {
            editor
                .chain()
                .focus()
                .setHeading({
                    level: 2,
                })
                .run()

            return
        }

        if (value === 'h3') {
            editor
                .chain()
                .focus()
                .setHeading({
                    level: 3,
                })
                .run()
        }
    }

    return (
        <select
            className="mw-tiptap-format-select"
            value={getCurrentFormat()}
            onChange={(event) =>
                handleChange(
                    event.target.value
                )
            }
            aria-label="Text format"
        >
            <option value="paragraph">
                Paragraph
            </option>

            <option value="h1">
                Heading 1
            </option>

            <option value="h2">
                Heading 2
            </option>

            <option value="h3">
                Heading 3
            </option>
        </select>
    )
}