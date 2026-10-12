import type { ReactNode } from "react"

type IconProps = { className?: string; size?: number; title?: string }

function Svg({ children, className, size = 20, title }: IconProps & { children: ReactNode }) {
  return (
    <svg
      className={className ? `app-icon ${className}` : "app-icon"}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  )
}

/** Three horizontal lines — trip drawer / switcher */
export function IconMenu(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Svg>
  )
}

/** Curved upward share arrow (no upload tray) */
export function IconShare(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 20V10a4 4 0 0 1 4-4h12" />
      <path d="m15 2 5 4-5 4" />
    </Svg>
  )
}

export function IconHome(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5z" />
    </Svg>
  )
}

export function IconPlan(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </Svg>
  )
}

export function IconPack(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="8" width="16" height="12" rx="2" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
      <path d="M4 13h16" />
    </Svg>
  )
}

export function IconBudget(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M9.5 9.5c.8-1 2-1.5 2.5-1.5s2 .6 2 1.75-1.2 1.75-2.5 2.25-2.5 1.1-2.5 2.4c0 1.2 1.1 2.1 2.5 2.1s2.1-.6 2.6-1.4" />
    </Svg>
  )
}

export function IconExplore(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </Svg>
  )
}

export function IconMemories(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 8h3l2-2h6l2 2h3v11H4V8z" />
      <circle cx="12" cy="13" r="3.5" />
    </Svg>
  )
}

export function IconDocs(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M7 3h7l5 5v13H7V3z" />
      <path d="M14 3v5h5M10 13h6M10 17h4" />
    </Svg>
  )
}

export function IconMap(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </Svg>
  )
}

/** Same glyph as Budget tab — log expense */
export function IconExpense(props: IconProps) {
  return <IconBudget {...props} />
}

export function IconCamera(props: IconProps) {
  return <IconMemories {...props} />
}

/** List / jump to itinerary */
export function IconItinerary(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </Svg>
  )
}
