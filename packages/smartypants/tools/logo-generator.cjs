#!/usr/bin/env node

// Rainbow ASCII Logo Generator for Smartypants
// Based on the beautiful rainbow gradient ASCII art design
// ASCII art generated using: https://patorjk.com/software/taag/

// ASCII art definitions
const ASCII_ART = {
  full: [
    "                                         888             ",
    "                                         888             ",
    "                                         888             ",
    " .d8888b  88888b.d88b.   8888b.  888d789 888888 888  888 ",
    ' 88K      888 "888 "88b     "88b 888P"   888    888  888 ',
    ' "Y8888b. 888  888  888 .d888888 888     888    888  888 ',
    "      X88 888  888  888 888  888 888     Y88b.  Y88b 888 ",
    '  88888P\' 888  888  888 "Y888888 888      "Y888  "Y88888 ',
    "                                                     888 ",
    "                                                Y8b d88P ",
    '                                                 "Y88P"  ',
  ],
}

// Color scheme definitions
const GRADIENTS = {
  rainbow: [
    { offset: "0%", color: "#ff0000" },
    { offset: "16.66%", color: "#ff8000" },
    { offset: "33.33%", color: "#ffff00" },
    { offset: "50%", color: "#00ff00" },
    { offset: "66.66%", color: "#0080ff" },
    { offset: "83.33%", color: "#8000ff" },
    { offset: "100%", color: "#ff0080" },
  ],
  blue: [
    { offset: "0%", color: "#001a33" },
    { offset: "33%", color: "#0066cc" },
    { offset: "66%", color: "#3399ff" },
    { offset: "100%", color: "#66ccff" },
  ],
  purple: [
    { offset: "0%", color: "#2a0845" },
    { offset: "50%", color: "#7b2cbf" },
    { offset: "100%", color: "#c77dff" },
  ],
  green: [
    { offset: "0%", color: "#0d1b2a" },
    { offset: "50%", color: "#168aad" },
    { offset: "100%", color: "#52b788" },
  ],
  red: [
    { offset: "0%", color: "#660708" },
    { offset: "50%", color: "#e5383b" },
    { offset: "100%", color: "#ff6b6b" },
  ],
  mono: [
    { offset: "0%", color: "#ffffff" },
    { offset: "100%", color: "#ffffff" },
  ],
}

function createGradient(theme, gradientId) {
  const selectedGradient = GRADIENTS[theme] || GRADIENTS.rainbow
  return `<linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="0%">
            ${selectedGradient
              .map((stop) => `<stop offset="${stop.offset}" style="stop-color:${stop.color}" />`)
              .join("\n            ")}
        </linearGradient>`
}

function createGlowFilter(glowIntensity) {
  return `<filter id="glow">
            <feGaussianBlur stdDeviation="${glowIntensity}" result="coloredBlur"/>
            <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
            </feMerge>
        </filter>`
}

function createAsciiText(lines, x, y, fontSize, lineHeight, fillUrl) {
  return `<text x="${x}" y="${y}" font-family="monospace" font-size="${fontSize}" font-weight="bold" fill="${fillUrl}" filter="url(#glow)" xml:space="preserve">
        ${lines
          .map((line, index) => `<tspan x="${x}" dy="${index === 0 ? "0" : lineHeight}">${line}</tspan>`)
          .join("\n        ")}
    </text>`
}

function createRainbowLogo(options = {}) {
  const { width = 600, height = 180, fontSize = 12, glowIntensity = 2, theme = "rainbow", lineHeight = 14 } = options

  const gradientId = `${theme}Gradient`

  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
        ${createGradient(theme, gradientId)}
        ${createGlowFilter(glowIntensity)}
    </defs>
    
    ${createAsciiText(ASCII_ART.full, 10, 30, fontSize, lineHeight, `url(#${gradientId})`)}
</svg>`
}

// Generate different variants
const variants = {
  // Main logos
  "logo-rainbow-light": createRainbowLogo({ theme: "rainbow" }),
  "logo-rainbow-dark": createRainbowLogo({ theme: "rainbow" }),
  "logo-blue": createRainbowLogo({ theme: "blue" }),
  "logo-purple": createRainbowLogo({ theme: "purple" }),
  "logo-green": createRainbowLogo({ theme: "green" }),
  "logo-red": createRainbowLogo({ theme: "red" }),
  "logo-mono": createRainbowLogo({ theme: "mono" }),

  // Compact versions
  "logo-rainbow-compact": createRainbowLogo({
    theme: "rainbow",
    width: 480,
    height: 150,
    fontSize: 10,
  }),

  // Large versions
  "logo-rainbow-large": createRainbowLogo({
    theme: "rainbow",
    width: 900,
    height: 270,
    fontSize: 18,
    glowIntensity: 3,
  }),

  // High contrast for dark themes
  "logo-rainbow-dark-contrast": createRainbowLogo({
    theme: "rainbow",
    glowIntensity: 4,
  }),
}

// If running as script, output all variants
if (require.main === module) {
  const fs = require("fs")
  const path = require("path")

  // Create output directory
  const outputDir = "./rainbow-logos"
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir)
  }

  // Generate all variants
  Object.entries(variants).forEach(([name, svg]) => {
    const filename = path.join(outputDir, `${name}.svg`)
    fs.writeFileSync(filename, svg)
    console.log(`Generated: ${filename}`)
  })

  console.log("\n🌈 Generated rainbow logo variants:")
  Object.keys(variants).forEach((name) => console.log(`  - ${name}.svg`))
}

module.exports = { createRainbowLogo, variants }
