interface IconProps {
    size?: number
}

const shared = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap:
        'round' as const,
    strokeLinejoin:
        'round' as const,
}

export function VideoIcon({
    size = 18,
}: IconProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            aria-hidden="true"
            focusable="false"
        >
            <rect
                x="3"
                y="5"
                width="13"
                height="14"
                rx="2"
                {...shared}
            />
            <path
                d="m16 10 5-3v10l-5-3z"
                {...shared}
            />
        </svg>
    )
}

export function TableIcon({
    size = 18,
}: IconProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            aria-hidden="true"
            focusable="false"
        >
            <rect
                x="3"
                y="3"
                width="18"
                height="18"
                rx="2"
                {...shared}
            />
            <path
                d="M3 9h18M9 3v18"
                {...shared}
            />
        </svg>
    )
}

export function NewsBlockIcon({
    size = 18,
}: IconProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            aria-hidden="true"
            focusable="false"
        >
            <rect
                x="4"
                y="3"
                width="16"
                height="18"
                rx="2"
                {...shared}
            />
            <path
                d="M8 7h8M8 11h8M8 15h5"
                {...shared}
            />
            <rect
                x="7.5"
                y="17.5"
                width="3"
                height="1"
                rx=".5"
                fill="currentColor"
                stroke="none"
            />
        </svg>
    )
}

export function VisualModeIcon({
    size = 17,
}: IconProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            aria-hidden="true"
            focusable="false"
        >
            <path
                d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"
                {...shared}
            />
            <circle
                cx="12"
                cy="12"
                r="2.7"
                {...shared}
            />
        </svg>
    )
}

export function CodeModeIcon({
    size = 17,
}: IconProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            aria-hidden="true"
            focusable="false"
        >
            <path
                d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14"
                {...shared}
            />
        </svg>
    )
}
