import {
    useEffect,
    useId,
    useRef,
    type ReactNode,
} from 'react'

interface DialogProps {
    open: boolean

    title: string

    description?: string

    children: ReactNode

    onClose: () => void
}

export default function Dialog({
    open,
    title,
    description,
    children,
    onClose,
}: DialogProps) {
    const titleId = useId()
    const descriptionId = useId()
    const panel = useRef<HTMLDivElement>(null)
    const opener = useRef<HTMLElement | null>(null)
    const close = useRef(onClose)

    useEffect(() => { close.current = onClose }, [onClose])

    // Capture the opener before a child input's autoFocus runs on mount.
    useEffect(() => {
        if (open) return
        const remember = (event: FocusEvent) => {
            const target = event.target
            if (target instanceof HTMLElement && !target.closest('.mw-dialog')) {
                opener.current = target
            }
        }
        if (document.activeElement instanceof HTMLElement &&
            !document.activeElement.closest('.mw-dialog') && document.activeElement !== document.body) {
            opener.current = document.activeElement
        }
        document.addEventListener('focusin', remember)
        return () => document.removeEventListener('focusin', remember)
    }, [open])

    useEffect(() => {
        if (!open || !panel.current) return
        const dialog = panel.current
        const previous = opener.current
        const previousOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'

        const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(
            'button, input, select, textarea, a[href], [tabindex]'
        )).filter(element => element.tabIndex >= 0 && !element.matches(':disabled') &&
            element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden')
        const focusFirst = () => (focusable()[0] ?? dialog).focus({ preventScroll: true })
        if (!dialog.contains(document.activeElement)) focusFirst()

        const handleKeyDown = (event: KeyboardEvent) => {
            // A second independent dialog must not handle this dialog's keys.
            const dialogs = document.querySelectorAll('.mw-dialog[aria-modal="true"]')
            if (dialogs[dialogs.length - 1] !== dialog) return
            if (event.key === 'Escape') {
                event.preventDefault()
                event.stopPropagation()
                close.current()
            } else if (event.key === 'Tab') {
                const elements = focusable()
                const first = elements[0], last = elements[elements.length - 1]
                const active = document.activeElement
                if (!first || !last) {
                    event.preventDefault(); dialog.focus(); return
                }
                if (!dialog.contains(active) || active === dialog || (event.shiftKey ? active === first : active === last)) {
                    event.preventDefault()
                    ;(event.shiftKey ? last : first).focus()
                }
            }
        }
        document.addEventListener('keydown', handleKeyDown)
        return () => {
            document.removeEventListener('keydown', handleKeyDown)
            document.body.style.overflow = previousOverflow
            // Successful commands intentionally focus the editor; do not steal that focus.
            const active = document.activeElement
            if ((active === document.body || dialog.contains(active)) && previous?.isConnected && !previous.matches(':disabled')) {
                previous.focus({ preventScroll: true })
            }
        }
    }, [open])

    if (!open) {
        return null
    }

    return (
        <div
            className="mw-dialog-backdrop"
            onMouseDown={(event) => {
                if (
                    event.target ===
                    event.currentTarget
                ) {
                    onClose()
                }
            }}
        >
            <div
                className="mw-dialog"
                role="dialog"
                aria-modal="true"
                ref={panel}
                tabIndex={-1}
                aria-labelledby={titleId}
                aria-describedby={description ? descriptionId : undefined}
            >
                <div className="mw-dialog-header">
                    <div>
                        <h2
                            id={titleId}
                            className="mw-dialog-title"
                        >
                            {title}
                        </h2>

                        {description && (
                            <p id={descriptionId} className="mw-dialog-description">
                                {description}
                            </p>
                        )}
                    </div>

                    <button
                        type="button"
                        className="mw-dialog-close"
                        onClick={onClose}
                        aria-label="Close"
                    >
                        ×
                    </button>
                </div>

                {children}
            </div>
        </div>
    )
}