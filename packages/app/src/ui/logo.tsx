import type { ComponentProps } from "solid-js"

// ASCII art generated using: https://patorjk.com/software/taag/

export interface LogoProps extends ComponentProps<"svg"> {
  variant?: "mark" | "full" | "ornate"
  size?: number
  theme?: "rainbow" | "mono"
}

// ASCII art definitions from logos.txt
const ASCII_ART = {
  mark: [
    "                    ",
    " .oooo.o oo.oooo.  ",
    "d88(  \"8  888' `88b ",
    '`"Y88b.   88    888 ',
    "o.  )88b  88bod8P' ",
    '8""888P\'  888       ',
    "         o888o      ",
  ],
  full: [
    "                                                  .               ",
    "                                                .o8               ",
    " .oooo.o ooo. .oo.  .oo.    .oooo.   oooo d8b .o888oo oooo    ooo ",
    'd88(  "8 `888P"Y88bP"Y88b  `P  )88b  `888""8P   888    `88.  .8\'  ',
    '`"Y88b.   888   888   888   .oP"888   888       888     `88..8\'   ',
    "o.  )88b  888   888   888  d8(  888   888       888 .    `888'    ",
    '8""888P\' o888o o888o o888o `Y888""8o d888b      "888"     .8\'     ',
    "                                                      .o..P'      ",
    "                                                      `Y8P'       ",
  ],
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
      <feGaussianBlur stdDeviation={glowIntensity} result="coloredBlur" />
      <feMerge>
        <feMergeNode in="coloredBlur" />
        <feMergeNode in="SourceGraphic" />
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
    style="white-space: pre"
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
    return (
      <svg
        width={size}
        height={size * 0.5} // Compact ratio for "sp"
        viewBox="0 0 160 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        class={`text-text ${props.class ?? ""}`}
        {...others}
      >
        {shouldUseFilter && createGradientDefs(1)}
        <AsciiText
          lines={ASCII_ART.mark}
          x={5}
          y={15}
          fontSize={8}
          lineHeight={10}
          fill={fillColor}
          filter={shouldUseFilter ? "url(#glow)" : undefined}
        />
      </svg>
    )
  }

  // Full and ornate variants share the same structure
  const isOrnate = variant === "ornate"
  const glowIntensity = isOrnate ? 3 : 1
  const aspectRatio = 500 / 140 // Adjusted for new ASCII art
  const scaledWidth = size * aspectRatio

  return (
    <svg
      width={scaledWidth}
      height={size}
      viewBox="0 0 500 140"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...others}
    >
      {shouldUseFilter && createGradientDefs(glowIntensity)}
      <AsciiText
        lines={ASCII_ART.full}
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
