import {
    useEffect,
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
    useEffect(() => {
        if (!open) {
            return
        }

        const handleKeyDown = (
            event: KeyboardEvent
        ) => {
            if (event.key === 'Escape') {
                onClose()
            }
        }

        document.addEventListener(
            'keydown',
            handleKeyDown
        )

        const previousOverflow =
            document.body.style.overflow

        document.body.style.overflow =
            'hidden'

        return () => {
            document.removeEventListener(
                'keydown',
                handleKeyDown
            )

            document.body.style.overflow =
                previousOverflow
        }
    }, [open, onClose])

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
                aria-labelledby="mw-dialog-title"
            >
                <div className="mw-dialog-header">
                    <div>
                        <h2
                            id="mw-dialog-title"
                            className="mw-dialog-title"
                        >
                            {title}
                        </h2>

                        {description && (
                            <p className="mw-dialog-description">
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