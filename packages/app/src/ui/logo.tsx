import type { ComponentProps } from "solid-js"

// ASCII art generated using: https://patorjk.com/software/taag/

export interface LogoProps extends ComponentProps<"svg"> {
  variant?: "mark" | "full" | "ornate"
  size?: number
  theme?: "rainbow" | "mono"
}

// ASCII art definitions
const ASCII_ART = {
  mark: [
    "                    ",
    " .d8888b  888888b. ",
    " 88K      888   888",
    " \"Y8888b. 888888P\" ",
    "      X88 888      ",
    "  88888P' 888      "
  ],
  full: [
    "                                         888             ",
    "                                         888             ",
    "                                         888             ",
    " .d8888b  88888b.d88b.   8888b.  888d888 888888 888  888 ",
    " 88K      888 \"888 \"88b     \"88b 888P\"   888    888  888 ",
    " \"Y8888b. 888  888  888 .d888888 888     888    888  888 ",
    "      X88 888  888  888 888  888 888     Y88b.  Y88b 888 ",
    "  88888P' 888  888  888 \"Y888888 888      \"Y888  \"Y88888 ",
    "                                                     888 ",
    "                                                Y8b d88P ",
    "                                                 \"Y88P\"  "
  ]
}

// Reusable gradient definitions
const createGradientDefs = (glowIntensity: number = 1) => (
  <defs>
    <linearGradient id="rainbow" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#ff0000" />
      <stop offset="16.66%" style="stop-color:#ff8000" />
      <stop offset="33.33%" style="stop-color:#ffff00" />
      <stop offset="50%" style="stop-color:#00ff00" />
      <stop offset="66.66%" style="stop-color:#0080ff" />
      <stop offset="83.33%" style="stop-color:#8000ff" />
      <stop offset="100%" style="stop-color:#ff0080" />
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation={glowIntensity} result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
)

// Reusable ASCII text component
const AsciiText = (props: {
  lines: string[]
  x: number
  y: number
  fontSize: number
  lineHeight: number
  fill: string
  filter?: string
}) => (
  <text 
    x={props.x} 
    y={props.y} 
    font-family="monospace" 
    font-size={props.fontSize} 
    font-weight="bold"
    fill={props.fill} 
    filter={props.filter} 
    xml:space="preserve"
  >
    {props.lines.map((line, index) => (
      <tspan x={props.x} dy={index === 0 ? "0" : props.lineHeight}>
        {line}
      </tspan>
    ))}
  </text>
)

export function Logo(props: LogoProps) {
  const { variant = "mark", size = 64, theme = "rainbow", ...others } = props

  const fillColor = theme === "rainbow" ? "url(#rainbow)" : "currentColor"
  const shouldUseFilter = theme === "rainbow"

  if (variant === "mark") {
    const scale = size / 200 // Base size is 200px wide
    return (
      <svg
        width={size}
        height={size * 0.45} // 90/200 aspect ratio
        viewBox="0 0 200 90"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        class={`text-text ${props.class ?? ""}`}
        {...others}
      >
        {shouldUseFilter && createGradientDefs(1)}
        <AsciiText
          lines={ASCII_ART.mark}
          x={5}
          y={20}
          fontSize={10}
          lineHeight={12}
          fill={fillColor}
          filter={shouldUseFilter ? "url(#glow)" : undefined}
        />
      </svg>
    )
  }

  // Full and ornate variants share the same structure
  const isOrnate = variant === "ornate"
  const glowIntensity = isOrnate ? 3 : 1
  const scale = size / 180
  const scaledWidth = 600 * scale

  return (
    <svg
      width={scaledWidth}
      height={size}
      viewBox="0 0 600 180"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...others}
    >
      {shouldUseFilter && createGradientDefs(glowIntensity)}
      <AsciiText
        lines={ASCII_ART.full}
        x={10}
        y={30}
        fontSize={12}
        lineHeight={14}
        fill={fillColor}
        filter={shouldUseFilter ? "url(#glow)" : undefined}
      />
    </svg>
  )
}
