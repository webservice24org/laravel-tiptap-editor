import {
    useEffect,
    useState,
} from 'react'

import type {
    Editor,
} from '@tiptap/react'

import Dialog from './Dialog'

interface TablePropertiesDialogProps {
    editor: Editor
    open: boolean
    onClose: () => void
}

type TableWidthMode =
    | 'auto'
    | '50'
    | '75'
    | 'full'

type TableAlignment =
    | 'left'
    | 'center'
    | 'right'

type TableBorderStyle =
    | 'solid'
    | 'dashed'
    | 'dotted'

export default function TablePropertiesDialog({
    editor,
    open,
    onClose,
}: TablePropertiesDialogProps) {
    const [
        widthMode,
        setWidthMode,
    ] =
        useState<TableWidthMode>(
            'full'
        )

    const [
        tableAlign,
        setTableAlign,
    ] =
        useState<TableAlignment>(
            'center'
        )

    const [
        cellPadding,
        setCellPadding,
    ] =
        useState(10)

    const [
        borderColor,
        setBorderColor,
    ] =
        useState('#d4d4d4')

    const [
        borderWidth,
        setBorderWidth,
    ] =
        useState(1)

    const [
        borderStyle,
        setBorderStyle,
    ] =
        useState<TableBorderStyle>(
            'solid'
        )

    useEffect(() => {
        if (!open) {
            return
        }

        const attributes =
            editor.getAttributes(
                'table'
            )

        const currentWidth =
            attributes.widthMode

        setWidthMode(
            currentWidth ===
                'auto' ||
                currentWidth ===
                    '50' ||
                currentWidth ===
                    '75'
                ? currentWidth
                : 'full'
        )

        setTableAlign(
            attributes.tableAlign ===
                'left' ||
                attributes.tableAlign ===
                    'right'
                ? attributes.tableAlign
                : 'center'
        )

        setCellPadding(
            Number(
                attributes.cellPadding ??
                10
            )
        )

        setBorderColor(
            attributes.borderColor ??
            '#d4d4d4'
        )

        setBorderWidth(
            Number(
                attributes.borderWidth ??
                1
            )
        )

        setBorderStyle(
            attributes.borderStyle ===
                'dashed' ||
                attributes.borderStyle ===
                    'dotted'
                ? attributes.borderStyle
                : 'solid'
        )
    }, [
        editor,
        open,
    ])

    const handleApply = () => {
        const safePadding =
            Math.max(
                0,
                Math.min(
                    40,
                    Number(
                        cellPadding
                    ) || 0
                )
            )

        const safeBorderWidth =
            Math.max(
                0,
                Math.min(
                    10,
                    Number(
                        borderWidth
                    ) || 0
                )
            )

        editor
            .chain()
            .focus()
            .updateAttributes(
                'table',
                {
                    widthMode,
                    tableAlign,

                    cellPadding:
                        safePadding,

                    borderColor,

                    borderWidth:
                        safeBorderWidth,

                    borderStyle,
                }
            )
            .run()

        onClose()
    }

    return (
        <Dialog
            open={open}
            onClose={onClose}
            title="Table Properties"
            description="Control table width, alignment, cell spacing, and borders."
        >
            <div className="mw-dialog-body">
                <section className="mw-table-properties-section">
                    <h3 className="mw-table-properties-heading">
                        Table
                    </h3>

                    <div className="mw-table-properties-grid">
                        <div className="mw-form-group">
                            <label
                                className="mw-form-label"
                                htmlFor="mw-table-width"
                            >
                                Width
                            </label>

                            <select
                                id="mw-table-width"
                                className="mw-form-input"
                                value={
                                    widthMode
                                }
                                onChange={(
                                    event
                                ) =>
                                    setWidthMode(
                                        event
                                            .target
                                            .value as TableWidthMode
                                    )
                                }
                            >
                                <option value="auto">
                                    Auto
                                </option>

                                <option value="50">
                                    50%
                                </option>

                                <option value="75">
                                    75%
                                </option>

                                <option value="full">
                                    100%
                                </option>
                            </select>
                        </div>

                        <div className="mw-form-group">
                            <label
                                className="mw-form-label"
                                htmlFor="mw-table-align"
                            >
                                Alignment
                            </label>

                            <select
                                id="mw-table-align"
                                className="mw-form-input"
                                value={
                                    tableAlign
                                }
                                onChange={(
                                    event
                                ) =>
                                    setTableAlign(
                                        event
                                            .target
                                            .value as TableAlignment
                                    )
                                }
                            >
                                <option value="left">
                                    Left
                                </option>

                                <option value="center">
                                    Center
                                </option>

                                <option value="right">
                                    Right
                                </option>
                            </select>
                        </div>
                    </div>
                </section>

                <section className="mw-table-properties-section">
                    <h3 className="mw-table-properties-heading">
                        Cells
                    </h3>

                    <div className="mw-table-properties-grid">
                        <div className="mw-form-group">
                            <label
                                className="mw-form-label"
                                htmlFor="mw-table-cell-padding"
                            >
                                Cell Padding
                                (px)
                            </label>

                            <input
                                id="mw-table-cell-padding"
                                type="number"
                                min="0"
                                max="40"
                                step="1"
                                className="mw-form-input"
                                value={
                                    cellPadding
                                }
                                onChange={(
                                    event
                                ) =>
                                    setCellPadding(
                                        Number(
                                            event
                                                .target
                                                .value
                                        )
                                    )
                                }
                            />
                        </div>
                    </div>

                    <p className="mw-table-properties-help">
                        Horizontal and vertical
                        alignment, background
                        color, and text color
                        remain available in the
                        contextual table toolbar.
                    </p>
                </section>

                <section className="mw-table-properties-section">
                    <h3 className="mw-table-properties-heading">
                        Border
                    </h3>

                    <div className="mw-table-properties-grid mw-table-properties-grid-three">
                        <div className="mw-form-group">
                            <label
                                className="mw-form-label"
                                htmlFor="mw-table-border-color"
                            >
                                Color
                            </label>

                            <div className="mw-table-properties-color">
                                <input
                                    id="mw-table-border-color"
                                    type="color"
                                    value={
                                        borderColor
                                    }
                                    onChange={(
                                        event
                                    ) =>
                                        setBorderColor(
                                            event
                                                .target
                                                .value
                                        )
                                    }
                                />

                                <span>
                                    {
                                        borderColor
                                    }
                                </span>
                            </div>
                        </div>

                        <div className="mw-form-group">
                            <label
                                className="mw-form-label"
                                htmlFor="mw-table-border-width"
                            >
                                Width
                                (px)
                            </label>

                            <input
                                id="mw-table-border-width"
                                type="number"
                                min="0"
                                max="10"
                                step="1"
                                className="mw-form-input"
                                value={
                                    borderWidth
                                }
                                onChange={(
                                    event
                                ) =>
                                    setBorderWidth(
                                        Number(
                                            event
                                                .target
                                                .value
                                        )
                                    )
                                }
                            />
                        </div>

                        <div className="mw-form-group">
                            <label
                                className="mw-form-label"
                                htmlFor="mw-table-border-style"
                            >
                                Style
                            </label>

                            <select
                                id="mw-table-border-style"
                                className="mw-form-input"
                                value={
                                    borderStyle
                                }
                                onChange={(
                                    event
                                ) =>
                                    setBorderStyle(
                                        event
                                            .target
                                            .value as TableBorderStyle
                                    )
                                }
                            >
                                <option value="solid">
                                    Solid
                                </option>

                                <option value="dashed">
                                    Dashed
                                </option>

                                <option value="dotted">
                                    Dotted
                                </option>
                            </select>
                        </div>
                    </div>
                </section>
            </div>

            <div className="mw-dialog-footer">
                <div />

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
                        onClick={
                            handleApply
                        }
                    >
                        Apply
                    </button>
                </div>
            </div>
        </Dialog>
    )
}
