import {
    useEffect,
    useState,
} from 'react'

import type {
    Editor,
} from '@tiptap/react'

import Dialog
    from './Dialog'

interface TableDialogProps {
    editor: Editor

    open: boolean

    onClose: () => void
}

export default function TableDialog({
    editor,
    open,
    onClose,
}: TableDialogProps) {
    const [
        rows,
        setRows,
    ] =
        useState(
            3
        )

    const [
        columns,
        setColumns,
    ] =
        useState(
            3
        )

    const [
        withHeader,
        setWithHeader,
    ] =
        useState(
            true
        )

    useEffect(() => {
        if (!open) {
            return
        }

        setRows(
            3
        )

        setColumns(
            3
        )

        setWithHeader(
            true
        )
    }, [open])

    const normalizeNumber = (
        value: number,
        min: number,
        max: number
    ) => {
        return Math.max(
            min,

            Math.min(
                max,
                value
            )
        )
    }

    const handleInsert =
        () => {
            const safeRows =
                normalizeNumber(
                    rows,
                    1,
                    20
                )

            const safeColumns =
                normalizeNumber(
                    columns,
                    1,
                    12
                )

            editor
                .chain()
                .focus()
                .insertTable({
                    rows:
                        safeRows,

                    cols:
                        safeColumns,

                    withHeaderRow:
                        withHeader,
                })
                .run()

            onClose()
        }

    return (
        <Dialog
            open={
                open
            }
            onClose={
                onClose
            }
            title="Insert Table"
            description="Choose the number of rows and columns."
        >
            <div className="mw-dialog-body">
                <div className="mw-table-dialog-grid">
                    <div className="mw-form-group">
                        <label
                            className="mw-form-label"
                            htmlFor="mw-table-rows"
                        >
                            Rows
                        </label>

                        <input
                            id="mw-table-rows"
                            type="number"
                            min={
                                1
                            }
                            max={
                                20
                            }
                            className="mw-form-input"
                            value={
                                rows
                            }
                            onChange={(
                                event
                            ) =>
                                setRows(
                                    Number(
                                        event
                                            .target
                                            .value
                                    ) ||
                                        1
                                )
                            }
                        />
                    </div>

                    <div className="mw-form-group">
                        <label
                            className="mw-form-label"
                            htmlFor="mw-table-columns"
                        >
                            Columns
                        </label>

                        <input
                            id="mw-table-columns"
                            type="number"
                            min={
                                1
                            }
                            max={
                                12
                            }
                            className="mw-form-input"
                            value={
                                columns
                            }
                            onChange={(
                                event
                            ) =>
                                setColumns(
                                    Number(
                                        event
                                            .target
                                            .value
                                    ) ||
                                        1
                                )
                            }
                        />
                    </div>
                </div>

                <label className="mw-checkbox-row">
                    <input
                        type="checkbox"
                        checked={
                            withHeader
                        }
                        onChange={(
                            event
                        ) =>
                            setWithHeader(
                                event
                                    .target
                                    .checked
                            )
                        }
                    />

                    <span>
                        Include header row
                    </span>
                </label>
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
                            handleInsert
                        }
                    >
                        Insert Table
                    </button>
                </div>
            </div>
        </Dialog>
    )
}