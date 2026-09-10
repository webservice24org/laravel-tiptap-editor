import {
    useEffect,
    useState,
} from 'react'

import type {
    Editor,
} from '@tiptap/react'

import Dialog
    from './Dialog'

import {
    parseVideoUrl,
} from '../../utils/video'

interface VideoDialogProps {
    editor: Editor
    open: boolean
    onClose: () => void
}

export default function VideoDialog({
    editor,
    open,
    onClose,
}: VideoDialogProps) {
    const [
        url,
        setUrl,
    ] =
        useState('')

    const [
        caption,
        setCaption,
    ] =
        useState('')

    const [
        error,
        setError,
    ] =
        useState('')

    const parsed =
        parseVideoUrl(
            url
        )

    useEffect(() => {
        if (!open) {
            return
        }

        setUrl('')
        setCaption('')
        setError('')
    }, [open])

    const handleInsert =
        () => {
            setError('')

            const video =
                parseVideoUrl(
                    url
                )

            if (
                !video
            ) {
                setError(
                    'Please enter a valid YouTube or Vimeo URL.'
                )

                return
            }

            editor
                .chain()
                .focus()
                .insertVideoEmbed({
                    src:
                        video.embedUrl,

                    provider:
                        video.provider,

                    caption:
                        caption.trim(),

                    align:
                        'center',

                    width:
                        100,
                })
                .run()

            onClose()
        }

    return (
        <Dialog
            open={open}
            onClose={onClose}
            title="Insert Video"
            description="Paste a YouTube or Vimeo video URL."
        >
            <div className="mw-dialog-body">
                <div className="mw-form-group">
                    <label
                        className="mw-form-label"
                        htmlFor="mw-video-url"
                    >
                        Video URL
                    </label>

                    <input
                        id="mw-video-url"
                        type="url"
                        className="mw-form-input"
                        value={url}
                        onChange={(
                            event
                        ) => {
                            setUrl(
                                event.target.value
                            )

                            setError('')
                        }}
                        placeholder="https://youtube.com/watch?v=..."
                    />
                </div>

                {parsed && (
                    <div className="mw-video-dialog-preview">
                        <iframe
                            src={
                                parsed.embedUrl
                            }
                            title="Video preview"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                        />
                    </div>
                )}

                <div className="mw-form-group">
                    <label
                        className="mw-form-label"
                        htmlFor="mw-video-caption"
                    >
                        Caption

                        <span className="mw-form-optional">
                            {' '}
                            (optional)
                        </span>
                    </label>

                    <input
                        id="mw-video-caption"
                        type="text"
                        className="mw-form-input"
                        value={
                            caption
                        }
                        onChange={(
                            event
                        ) =>
                            setCaption(
                                event.target.value
                            )
                        }
                        placeholder="Video caption"
                    />
                </div>

                {error && (
                    <p className="mw-form-error">
                        {error}
                    </p>
                )}
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
                        Insert Video
                    </button>
                </div>
            </div>
        </Dialog>
    )
}