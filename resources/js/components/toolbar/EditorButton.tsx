import type {
    ButtonHTMLAttributes,
    ReactNode,
} from 'react'

interface EditorButtonProps
    extends Omit<
        ButtonHTMLAttributes<HTMLButtonElement>,
        'children' | 'title'
    > {
    children: ReactNode
    active?: boolean
    tooltip?: string
}

export default function EditorButton({
    children,
    active,
    disabled = false,
    tooltip,
    className,
    ...props
}: EditorButtonProps) {
    const classes = [
        'mw-tiptap-toolbar-button',
        active
            ? 'is-active'
            : '',
        className ?? '',
    ]
        .filter(Boolean)
        .join(' ')

    return (
        <button
            {...props}
            type="button"
            className={
                classes
            }
            disabled={
                disabled
            }
            title={
                tooltip
            }
            aria-label={
                tooltip
            }
            aria-pressed={active}
        >
            {children}
        </button>
    )
}
