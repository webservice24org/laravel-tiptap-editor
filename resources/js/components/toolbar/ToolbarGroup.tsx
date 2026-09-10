import type {
    ReactNode,
} from 'react'

interface ToolbarGroupProps {
    children: ReactNode
    label?: string
}

export default function ToolbarGroup({
    children,
    label,
}: ToolbarGroupProps) {
    return (
        <div
            className="mw-tiptap-toolbar-group"
            role="group"
            aria-label={
                label
            }
        >
            {children}
        </div>
    )
}
