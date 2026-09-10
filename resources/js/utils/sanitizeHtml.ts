import DOMPurify from 'dompurify'

const SAFE_DATA_ATTRIBUTES = [
    'data-align',
    'data-category',
    'data-clear-float',
    'data-colwidth',
    'data-excerpt',
    'data-mw-image',
    'data-mw-video',
    'data-mw-news-block',
    'data-mw-news-category',
    'data-mw-news-excerpt',
    'data-mw-news-title',
    'data-mw-path',
    'data-mw-table-properties',
    'data-news-id',
    'data-provider',
    'data-style',
    'data-table-align',
    'data-thumbnail',
    'data-title',
    'data-url',
    'data-width',
    'data-width-mode',
    'data-wrap',
    'data-border-color',
    'data-border-width',
    'data-border-style',
    'data-cell-padding',
] as const

const ALLOWED_TAGS = [
    'p',
    'br',
    'strong',
    'b',
    'em',
    'i',
    'u',
    's',
    'sub',
    'sup',
    'h1',
    'h2',
    'h3',
    'ul',
    'ol',
    'li',
    'blockquote',
    'hr',
    'a',
    'span',
    'div',
    'figure',
    'figcaption',
    'img',
    'iframe',
    'article',
    'table',
    'thead',
    'tbody',
    'tfoot',
    'tr',
    'th',
    'td',
    'colgroup',
    'col',
] as const

const ALLOWED_ATTR = [
    'href',
    'target',
    'rel',
    'src',
    'alt',
    'title',
    'class',
    'style',
    'loading',
    'decoding',
    'allow',
    'allowfullscreen',
    'referrerpolicy',
    'rowspan',
    'colspan',
    'colwidth',
    ...SAFE_DATA_ATTRIBUTES,
] as const

const SAFE_IFRAME_HOSTS = new Set([
    'www.youtube.com',
    'youtube.com',
    'www.youtube-nocookie.com',
    'youtube-nocookie.com',
    'player.vimeo.com',
])

const safeUrl = (
    value: string,
    allowRelative = true
) => {
    const url =
        value.trim()

    if (!url) {
        return ''
    }

    if (
        allowRelative &&
        (
            url.startsWith('/') ||
            url.startsWith('#')
        )
    ) {
        return url
    }

    try {
        const parsed =
            new URL(
                /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(
                    url
                )
                    ? url
                    : `https://${url}`
            )

        if (
            parsed.protocol !== 'http:' &&
            parsed.protocol !== 'https:'
        ) {
            return ''
        }

        return parsed.toString()
    } catch {
        return ''
    }
}

const sanitizeStyle = (
    style: string
) => {
    const allowedProperties =
        new Set([
            'text-align',
            'vertical-align',
            'background-color',
            'color',
            'width',
            'max-width',
            'margin-left',
            'margin-right',
            'clear',
            'border-width',
            'border-style',
            'border-color',
            'padding',
            '--mw-table-border-color',
            '--mw-table-border-width',
            '--mw-table-border-style',
            '--mw-table-cell-padding',
            '--mw-media-width',
        ])

    return style
        .split(';')
        .map(
            declaration =>
                declaration.trim()
        )
        .filter(Boolean)
        .map(
            declaration => {
                const separator =
                    declaration.indexOf(':')

                if (separator === -1) {
                    return ''
                }

                const property =
                    declaration
                        .slice(
                            0,
                            separator
                        )
                        .trim()
                        .toLowerCase()

                const value =
                    declaration
                        .slice(
                            separator + 1
                        )
                        .trim()

                if (
                    !allowedProperties.has(
                        property
                    )
                ) {
                    return ''
                }

                if (
                    /url\s*\(|expression\s*\(|javascript:|vbscript:|data:/i.test(
                        value
                    )
                ) {
                    return ''
                }

                return `${property}: ${value}`
            }
        )
        .filter(Boolean)
        .join('; ')
}

DOMPurify.addHook(
    'uponSanitizeAttribute',
    (
        node,
        data
    ) => {
        const name =
            data.attrName
                .toLowerCase()

        const value =
            data.attrValue

        if (
            name.startsWith('on')
        ) {
            data.keepAttr = false
            return
        }

        if (
            name === 'href'
        ) {
            const safe =
                safeUrl(
                    value,
                    true
                )

            if (!safe) {
                data.keepAttr = false
                return
            }

            data.attrValue =
                safe

            return
        }

        if (
            name === 'src'
        ) {
            const element =
                node as Element

            if (
                element.tagName
                    .toLowerCase() ===
                'iframe'
            ) {
                const safe =
                    safeUrl(
                        value,
                        false
                    )

                if (!safe) {
                    data.keepAttr = false
                    return
                }

                try {
                    const parsed =
                        new URL(
                            safe
                        )

                    if (
                        !SAFE_IFRAME_HOSTS.has(
                            parsed.hostname
                        )
                    ) {
                        data.keepAttr = false
                        return
                    }

                    data.attrValue =
                        safe
                } catch {
                    data.keepAttr = false
                }

                return
            }

            const safe =
                safeUrl(
                    value,
                    true
                )

            if (!safe) {
                data.keepAttr = false
                return
            }

            data.attrValue =
                safe

            return
        }

        if (
            name === 'style'
        ) {
            const clean =
                sanitizeStyle(
                    value
                )

            if (!clean) {
                data.keepAttr = false
                return
            }

            data.attrValue =
                clean
        }
    }
)

export const sanitizeEditorHtml = (
    html: string
) => {
    return DOMPurify.sanitize(
        html,
        {
            ALLOWED_TAGS:
                [...ALLOWED_TAGS],

            ALLOWED_ATTR:
                [...ALLOWED_ATTR],

            ALLOW_DATA_ATTR:
                false,

            KEEP_CONTENT:
                true,

            RETURN_TRUSTED_TYPE:
                false,
        }
    )
}
