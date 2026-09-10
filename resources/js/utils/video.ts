import type {
    VideoProvider,
} from '../extensions/VideoEmbed'

export interface ParsedVideo {
    provider:
        VideoProvider

    embedUrl:
        string
}

export function parseVideoUrl(
    value: string
): ParsedVideo | null {
    const input =
        value.trim()

    if (!input) {
        return null
    }

    let url: URL

    try {
        url =
            new URL(
                input
            )
    } catch {
        return null
    }

    const hostname =
        url.hostname
            .replace(
                /^www\./,
                ''
            )
            .toLowerCase()

    /*
    |--------------------------------------------------------------------------
    | YouTube
    |--------------------------------------------------------------------------
    */

    if (
        hostname ===
        'youtube.com' ||
        hostname ===
        'm.youtube.com'
    ) {
        if (
            url.pathname ===
            '/watch'
        ) {
            const videoId =
                url.searchParams.get(
                    'v'
                )

            if (
                videoId
            ) {
                return {
                    provider:
                        'youtube',

                    embedUrl:
                        `https://www.youtube.com/embed/${videoId}`,
                }
            }
        }

        const embedMatch =
            url.pathname.match(
                /^\/embed\/([^/?]+)/
            )

        if (
            embedMatch?.[1]
        ) {
            return {
                provider:
                    'youtube',

                embedUrl:
                    `https://www.youtube.com/embed/${embedMatch[1]}`,
            }
        }

        const shortsMatch =
            url.pathname.match(
                /^\/shorts\/([^/?]+)/
            )

        if (
            shortsMatch?.[1]
        ) {
            return {
                provider:
                    'youtube',

                embedUrl:
                    `https://www.youtube.com/embed/${shortsMatch[1]}`,
            }
        }
    }

    if (
        hostname ===
        'youtu.be'
    ) {
        const videoId =
            url.pathname
                .split('/')
                .filter(Boolean)[0]

        if (
            videoId
        ) {
            return {
                provider:
                    'youtube',

                embedUrl:
                    `https://www.youtube.com/embed/${videoId}`,
            }
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Vimeo
    |--------------------------------------------------------------------------
    */

    if (
        hostname ===
        'vimeo.com' ||
        hostname ===
        'player.vimeo.com'
    ) {
        const match =
            url.pathname.match(
                /(?:video\/)?(\d+)/
            )

        if (
            match?.[1]
        ) {
            return {
                provider:
                    'vimeo',

                embedUrl:
                    `https://player.vimeo.com/video/${match[1]}`,
            }
        }
    }

    return null
}