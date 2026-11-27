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
    'code',
    'pre',
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
    'start',
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

// Link policy is deliberately narrower than media URL normalization.
// Only explicit web URLs, same-site root paths and fragments are persisted.
export function normalizeLinkUrl(value: string, allowBareHost = false): string {
    let url = value.replace(/^ +| +$/g, '')
    if (!url || url.length > 4096 || /[\p{C}\p{Z}\\]/u.test(url)) return ''
    if (url.startsWith('#') || (url.startsWith('/') && !url.startsWith('//'))) return url
    if (allowBareHost && /^[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:[/?#]|$)/i.test(url)) url = `https://${url}`
    if (!/^https?:\/\//i.test(url) || !/^https?:\/\/[^/?#]+/i.test(url) || /^https?:\/\/[^/?#]*@/i.test(url)) return ''
    try {
        const parsed = new URL(url)
        if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password) return ''
        return parsed.toString()
    } catch {
        return ''
    }
}

// Match the server image URL boundary: explicit HTTP(S) or root-relative.
// Blob URLs are used only for local file previews and never stored.
export function normalizeImageSource(value: string): string {
    const url = normalizeLinkUrl(value)
    return url.startsWith('#') ? '' : url
}

// Fixed presets avoid arbitrary CSS and remote font loading.
export const TEXT_PRESETS = {
    color: ['black', 'red', 'blue', 'green', 'purple'],
    'font-size': ['12px', '16px', '20px', '24px'],
    'font-family': ['sans-serif', 'serif', 'monospace'],
} as const
export type TextPresetProperty = keyof typeof TEXT_PRESETS
export function isTextPreset(property: TextPresetProperty, value: string): boolean {
    return (TEXT_PRESETS[property] as readonly string[]).includes(value)
}

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
    style: string,
    tag: string
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

                if (property === 'font-size' || property === 'font-family') {
                    return tag === 'span' && isTextPreset(property, value) ? `${property}: ${value}` : ''
                }

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

        // Numbered lists may start at a custom positive decimal integer.
        // Never allow this attribute on a different element or accept coercion.
        if (name === 'start') {
            if (node.nodeName.toLowerCase() !== 'ol' || !/^[1-9][0-9]{0,4}$/.test(value) || value.length !== value.trim().length) {
                data.keepAttr = false
            }
            return
        }

        if (
            name === 'href'
        ) {
            const safe = node.nodeName.toLowerCase() === 'a' ? normalizeLinkUrl(value) : ''

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

            const safe = element.tagName.toLowerCase() === 'img'
                ? normalizeImageSource(value)
                : safeUrl(value, true)

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
                    value, node.nodeName.toLowerCase()
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

// Normalize link target/rel after DOMPurify has checked attributes.
DOMPurify.addHook('afterSanitizeAttributes', node => {
    if (node.nodeName.toLowerCase() !== 'a') return
    const link = node as Element
    if (!link.hasAttribute('href')) {
        link.removeAttribute('target')
        link.removeAttribute('rel')
        return
    }
    const target = link.getAttribute('target')?.toLowerCase()
    if (target === '_blank' || target === '_self') link.setAttribute('target', target)
    else link.removeAttribute('target')
    const tokens = (link.getAttribute('rel') ?? '').toLowerCase().split(/\s+/)
        .filter(token => ['noopener', 'noreferrer', 'nofollow', 'ugc', 'sponsored', 'external'].includes(token))
    if (target === '_blank') tokens.push('noopener', 'noreferrer')
    if (tokens.length) link.setAttribute('rel', [...new Set(tokens)].join(' '))
    else link.removeAttribute('rel')
})

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
