interface IconProps {
    size?: number
}

const defaults = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
}

export function BoldIcon({
    size = 18,
}: IconProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            {...defaults}
        >
            <path d="M7 5h6a4 4 0 0 1 0 8H7z" />
            <path d="M7 13h7a4 4 0 0 1 0 8H7z" />
        </svg>
    )
}

export function ItalicIcon({
    size = 18,
}: IconProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            {...defaults}
        >
            <path d="M10 5h7" />
            <path d="M7 19h7" />
            <path d="M14 5 10 19" />
        </svg>
    )
}

export function UnderlineIcon({
    size = 18,
}: IconProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            {...defaults}
        >
            <path d="M7 4v6a5 5 0 0 0 10 0V4" />
            <path d="M5 21h14" />
        </svg>
    )
}

export function StrikeIcon({
    size = 18,
}: IconProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            {...defaults}
        >
            <path d="M17 6.5A6 6 0 0 0 12 4c-3 0-5 1.5-5 3.5 0 1.2.7 2 2 2.5" />
            <path d="M7 17.5A6 6 0 0 0 12 20c3 0 5-1.5 5-3.5 0-1.4-1-2.3-3-3" />
            <path d="M4 12h16" />
        </svg>
    )
}

export function SubscriptIcon({
    size = 18,
}: IconProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            {...defaults}
        >
            <path d="m5 5 8 11" />
            <path d="m13 5-8 11" />
            <path d="M16 17h4l-4 4h4" />
        </svg>
    )
}

export function SuperscriptIcon({
    size = 18,
}: IconProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            {...defaults}
        >
            <path d="m5 7 8 11" />
            <path d="m13 7-8 11" />
            <path d="M16 3h4l-4 4h4" />
        </svg>
    )
}

export function BulletListIcon({
    size = 18,
}: IconProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            {...defaults}
        >
            <circle cx="5" cy="7" r="1" fill="currentColor" />
            <circle cx="5" cy="12" r="1" fill="currentColor" />
            <circle cx="5" cy="17" r="1" fill="currentColor" />
            <path d="M9 7h10" />
            <path d="M9 12h10" />
            <path d="M9 17h10" />
        </svg>
    )
}

export function OrderedListIcon({
    size = 18,
}: IconProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            {...defaults}
        >
            <path d="M4 6h2v3" />
            <path d="M4 13h2l-2 3h2" />
            <path d="M10 7h10" />
            <path d="M10 15h10" />
        </svg>
    )
}

export function AlignLeftIcon({
    size = 18,
}: IconProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            {...defaults}
        >
            <path d="M4 6h16" />
            <path d="M4 10h10" />
            <path d="M4 14h16" />
            <path d="M4 18h10" />
        </svg>
    )
}

export function AlignCenterIcon({
    size = 18,
}: IconProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            {...defaults}
        >
            <path d="M4 6h16" />
            <path d="M7 10h10" />
            <path d="M4 14h16" />
            <path d="M7 18h10" />
        </svg>
    )
}

export function AlignRightIcon({
    size = 18,
}: IconProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            {...defaults}
        >
            <path d="M4 6h16" />
            <path d="M10 10h10" />
            <path d="M4 14h16" />
            <path d="M10 18h10" />
        </svg>
    )
}

export function JustifyIcon({
    size = 18,
}: IconProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            {...defaults}
        >
            <path d="M4 6h16" />
            <path d="M4 10h16" />
            <path d="M4 14h16" />
            <path d="M4 18h16" />
        </svg>
    )
}

export function QuoteIcon({
    size = 18,
}: IconProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            {...defaults}
        >
            <path d="M5 11h5v6H4v-5c0-4 2-6 6-7" />
            <path d="M14 11h5v6h-6v-5c0-4 2-6 6-7" />
        </svg>
    )
}

export function HorizontalRuleIcon({
    size = 18,
}: IconProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            {...defaults}
        >
            <path d="M4 12h16" />
        </svg>
    )
}

export function LinkIcon({
    size = 18,
}: IconProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            {...defaults}
        >
            <path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1" />

            <path d="M14 11a5 5 0 0 0-7.1-.1l-2 2a5 5 0 0 0 7.1 7.1l1.1-1.1" />
        </svg>
    )
}
export function UnlinkIcon({
    size = 18,
}: IconProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            {...defaults}
        >
            <path d="M9 15 7 17a4 4 0 0 1-6-6l2-2" />

            <path d="m15 9 2-2a4 4 0 0 1 6 6l-2 2" />

            <path d="M8 12h8" />

            <path d="m3 3 18 18" />
        </svg>
    )
}

export function UndoIcon({
    size = 18,
}: IconProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            {...defaults}
        >
            <path d="M9 7 4 12l5 5" />
            <path d="M4 12h9a6 6 0 0 1 6 6" />
        </svg>
    )
}

export function MediaIcon({
    size = 19,
}: IconProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            {...defaults}
        >
            <path d="M12 16V4" />

            <path d="m8 8 4-4 4 4" />

            <path d="M5 14a4 4 0 0 0 1 7h12a4 4 0 0 0 1-7" />
        </svg>
    )
}

export function ImageIcon({
    size = 18,
}: IconProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            {...defaults}
        >
            <rect
                x="3"
                y="4"
                width="18"
                height="16"
                rx="2"
            />

            <circle
                cx="9"
                cy="9"
                r="2"
            />

            <path d="m3 17 5-5 4 4 3-3 6 6" />
        </svg>
    )
}

export function RedoIcon({
    size = 18,
}: IconProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            {...defaults}
        >
            <path d="m15 7 5 5-5 5" />
            <path d="M20 12h-9a6 6 0 0 0-6 6" />
        </svg>
    )
}

export function ClearIcon({
    size = 18,
}: IconProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            {...defaults}
        >
            <path d="m4 20 7-7" />
            <path d="m13 11 5-5 2 2-5 5" />
            <path d="M3 21h8" />
        </svg>
    )
}
// List nesting controls; the arrow indicates the direction of nesting.
export function IndentListIcon({ size = 18 }: IconProps) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" {...defaults}>
            <path d="M3 4h18M11 9h10M11 15h10M3 20h18M3 9l4 3-4 3" />
        </svg>
    )
}

export function OutdentListIcon({ size = 18 }: IconProps) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" {...defaults}>
            <path d="M3 4h18M11 9h10M11 15h10M3 20h18M7 9l-4 3 4 3" />
        </svg>
    )
}
