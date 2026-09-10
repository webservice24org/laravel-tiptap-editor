import type {
    SVGProps,
} from 'react'

interface IconProps {
    size?: number
}

const svgProps = (
    size: number
): SVGProps<SVGSVGElement> => ({
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap:
        'round' as const,
    strokeLinejoin:
        'round' as const,
    'aria-hidden':
        true,
    focusable:
        false,
})

export function RowAboveIcon({
    size = 16,
}: IconProps) {
    return (
        <svg {...svgProps(size)}>
            <rect x="4" y="9" width="16" height="10" rx="1.5" />
            <path d="M8 13h8M12 3v4M9.5 5.5 12 3l2.5 2.5" />
        </svg>
    )
}

export function RowBelowIcon({
    size = 16,
}: IconProps) {
    return (
        <svg {...svgProps(size)}>
            <rect x="4" y="5" width="16" height="10" rx="1.5" />
            <path d="M8 11h8M12 21v-4M9.5 18.5 12 21l2.5-2.5" />
        </svg>
    )
}

export function DeleteRowIcon({
    size = 16,
}: IconProps) {
    return (
        <svg {...svgProps(size)}>
            <rect x="4" y="7" width="16" height="10" rx="1.5" />
            <path d="M8 12h8M9 3l6 6M15 3 9 9" />
        </svg>
    )
}

export function ColumnLeftIcon({
    size = 16,
}: IconProps) {
    return (
        <svg {...svgProps(size)}>
            <rect x="9" y="4" width="10" height="16" rx="1.5" />
            <path d="M13 8v8M3 12h4M5.5 9.5 3 12l2.5 2.5" />
        </svg>
    )
}

export function ColumnRightIcon({
    size = 16,
}: IconProps) {
    return (
        <svg {...svgProps(size)}>
            <rect x="5" y="4" width="10" height="16" rx="1.5" />
            <path d="M11 8v8M21 12h-4M18.5 9.5 21 12l-2.5 2.5" />
        </svg>
    )
}

export function DeleteColumnIcon({
    size = 16,
}: IconProps) {
    return (
        <svg {...svgProps(size)}>
            <rect x="7" y="4" width="10" height="16" rx="1.5" />
            <path d="M12 8v8M3 9l6 6M9 9l-6 6" />
        </svg>
    )
}

export function AlignLeftIcon({
    size = 16,
}: IconProps) {
    return (
        <svg {...svgProps(size)}>
            <path d="M4 6h13M4 10h9M4 14h13M4 18h9" />
        </svg>
    )
}

export function AlignCenterIcon({
    size = 16,
}: IconProps) {
    return (
        <svg {...svgProps(size)}>
            <path d="M5 6h14M7 10h10M5 14h14M7 18h10" />
        </svg>
    )
}

export function AlignRightIcon({
    size = 16,
}: IconProps) {
    return (
        <svg {...svgProps(size)}>
            <path d="M7 6h13M11 10h9M7 14h13M11 18h9" />
        </svg>
    )
}

export function AlignJustifyIcon({
    size = 16,
}: IconProps) {
    return (
        <svg {...svgProps(size)}>
            <path d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
    )
}

export function AlignTopIcon({
    size = 16,
}: IconProps) {
    return (
        <svg {...svgProps(size)}>
            <path d="M5 5h14M12 19V8M9 11l3-3 3 3" />
        </svg>
    )
}

export function AlignMiddleIcon({
    size = 16,
}: IconProps) {
    return (
        <svg {...svgProps(size)}>
            <path d="M5 12h14M12 5v14M9 8l3-3 3 3M9 16l3 3 3-3" />
        </svg>
    )
}

export function AlignBottomIcon({
    size = 16,
}: IconProps) {
    return (
        <svg {...svgProps(size)}>
            <path d="M5 19h14M12 5v11M9 13l3 3 3-3" />
        </svg>
    )
}

export function ClearColorIcon({
    size = 16,
}: IconProps) {
    return (
        <svg {...svgProps(size)}>
            <path d="m8 3 8 8-5 5H6l-3-3 5-10Z" />
            <path d="M4 20h16M3 3l18 18" />
        </svg>
    )
}

export function ClearTextColorIcon({
    size = 16,
}: IconProps) {
    return (
        <svg {...svgProps(size)}>
            <path d="M7 17 12 5l5 12M9 13h6M4 20h16M3 3l18 18" />
        </svg>
    )
}

export function MergeCellsIcon({
    size = 16,
}: IconProps) {
    return (
        <svg {...svgProps(size)}>
            <rect x="3" y="5" width="18" height="14" rx="1.5" />
            <path d="M8 12h8M10.5 9.5 8 12l2.5 2.5M13.5 9.5 16 12l-2.5 2.5" />
        </svg>
    )
}

export function SplitCellIcon({
    size = 16,
}: IconProps) {
    return (
        <svg {...svgProps(size)}>
            <rect x="3" y="5" width="18" height="14" rx="1.5" />
            <path d="M12 5v14M10 12H7M14 12h3M9 10l-2 2 2 2M15 10l2 2-2 2" />
        </svg>
    )
}

export function HeaderRowIcon({
    size = 16,
}: IconProps) {
    return (
        <svg {...svgProps(size)}>
            <rect x="3" y="4" width="18" height="16" rx="1.5" />
            <path d="M3 9h18M9 4v16M15 4v16" />
            <path d="M3 4h18v5H3z" fill="currentColor" opacity=".18" stroke="none" />
        </svg>
    )
}

export function HeaderColumnIcon({
    size = 16,
}: IconProps) {
    return (
        <svg {...svgProps(size)}>
            <rect x="3" y="4" width="18" height="16" rx="1.5" />
            <path d="M9 4v16M15 4v16M3 9h18M3 15h18" />
            <path d="M3 4h6v16H3z" fill="currentColor" opacity=".18" stroke="none" />
        </svg>
    )
}

export function HeaderCellIcon({
    size = 16,
}: IconProps) {
    return (
        <svg {...svgProps(size)}>
            <rect x="4" y="4" width="16" height="16" rx="1.5" />
            <path d="M12 4v16M4 12h16" />
            <path d="M4 4h8v8H4z" fill="currentColor" opacity=".18" stroke="none" />
        </svg>
    )
}

export function PropertiesIcon({
    size = 16,
}: IconProps) {
    return (
        <svg {...svgProps(size)}>
            <path d="M4 7h10M18 7h2M4 17h2M10 17h10M4 12h4M12 12h8" />
            <circle cx="16" cy="7" r="2" />
            <circle cx="8" cy="17" r="2" />
            <circle cx="10" cy="12" r="2" />
        </svg>
    )
}

export function DeleteTableIcon({
    size = 16,
}: IconProps) {
    return (
        <svg {...svgProps(size)}>
            <rect x="4" y="5" width="16" height="14" rx="1.5" />
            <path d="M4 10h16M10 5v14M3 3l18 18" />
        </svg>
    )
}
