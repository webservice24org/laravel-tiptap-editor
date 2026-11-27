import type { VideoProvider } from '../extensions/VideoEmbed'

export interface ParsedVideo {
    provider: VideoProvider
    embedUrl: string
}

// Explicit web URLs only. Reject credentials, ambiguous paths, ports and fragments.
function webUrl(value: string): URL | null {
    const input = value.replace(/^ +| +$/g, '')
    if (!/^https?:\/\//i.test(input) || input.length > 4096 || /[\p{C}\p{Z}\\]/u.test(input) || !/^https?:\/\/[^/?#]+/i.test(input) || /^https?:\/\/[^/?#]*[@:]/i.test(input)) return null
    try {
        const url = new URL(input)
        return !url.username && !url.password && !url.port && !url.hash ? url : null
    } catch { return null }
}

const youtubeHosts = new Set(['youtube.com', 'www.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com'])
const youtubeId = /^[A-Za-z0-9_-]{11}$/
const vimeoId = /^[0-9]{1,20}$/

// Persisted iframe policy mirrors EditorHtmlPolicy::videoUrl.
export function normalizeVideoEmbedUrl(value: string): string {
    const url = webUrl(value)
    if (!url || url.protocol !== 'https:' || value.includes('#')) return ''
    if (youtubeHosts.has(url.hostname) && /^\/embed\/[A-Za-z0-9_-]{11}$/.test(url.pathname)) return url.toString()
    if (url.hostname === 'player.vimeo.com' && /^\/video\/[0-9]{1,20}$/.test(url.pathname)) return url.toString()
    return ''
}

export function parseVideoUrl(value: string): ParsedVideo | null {
    const url = webUrl(value)
    if (!url) return null
    const host = url.hostname.replace(/^www\./, '')
    let id = ''
    if (host === 'youtube.com' || host === 'm.youtube.com') {
        id = url.pathname === '/watch' ? (url.searchParams.get('v') ?? '') : (url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)\/?$/)?.[1] ?? '')
    } else if (host === 'youtube-nocookie.com') {
        id = url.pathname.match(/^\/embed\/([^/]+)\/?$/)?.[1] ?? ''
        if (youtubeId.test(id)) return {provider: 'youtube', embedUrl: `https://www.youtube-nocookie.com/embed/${id}`}
    } else if (host === 'youtu.be') {
        id = url.pathname.match(/^\/([^/]+)\/?$/)?.[1] ?? ''
    }
    if (youtubeId.test(id)) return {provider: 'youtube', embedUrl: `https://www.youtube.com/embed/${id}`}
    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
        id = url.pathname.match(host === 'player.vimeo.com' ? /^\/video\/([0-9]+)\/?$/ : /^\/([0-9]+)\/?$/)?.[1] ?? ''
        if (vimeoId.test(id)) return {provider: 'vimeo', embedUrl: `https://player.vimeo.com/video/${id}`}
    }
    return null
}
