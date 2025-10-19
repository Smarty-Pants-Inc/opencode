import z from "zod/v4"
import { EOL } from "os"
import { NamedError } from "../util/error"

export namespace UI {
  const LOGO = [
    "OPENCODE",
  ]

  export const CancelledError = NamedError.create("UICancelledError", z.void())

  export const BRAND = process.env["BRAND"] ?? "opencode"

  export const Style = {
    TEXT_HIGHLIGHT: "\x1b[96m",
    TEXT_HIGHLIGHT_BOLD: "\x1b[96m\x1b[1m",
    TEXT_DIM: "\x1b[90m",
    TEXT_DIM_BOLD: "\x1b[90m\x1b[1m",
    TEXT_NORMAL: "\x1b[0m",
    TEXT_NORMAL_BOLD: "\x1b[1m",
    TEXT_WARNING: "\x1b[93m",
    TEXT_WARNING_BOLD: "\x1b[93m\x1b[1m",
    TEXT_DANGER: "\x1b[91m",
    TEXT_DANGER_BOLD: "\x1b[91m\x1b[1m",
    TEXT_SUCCESS: "\x1b[92m",
    TEXT_SUCCESS_BOLD: "\x1b[92m\x1b[1m",
    TEXT_INFO: "\x1b[94m",
    TEXT_INFO_BOLD: "\x1b[94m\x1b[1m",
  }

  export function println(...message: string[]) {
    print(...message)
    Bun.stderr.write(EOL)
  }

  export function print(...message: string[]) {
    blank = false
    Bun.stderr.write(message.join(" "))
  }

  let blank = false
  export function empty() {
    if (blank) return
    println("" + Style.TEXT_NORMAL)
    blank = true
  }

  function supportsTrueColor(): boolean {
    const c = (process.env["COLORTERM"] || "").toLowerCase()
    return c.includes("truecolor") || c.includes("24bit")
  }

  function rgbEsc(r: number, g: number, b: number): string {
    return `\x1b[38;2;${r};${g};${b}m`
  }

  function rainbowAnsi(code: number): string {
    return `\x1b[${code}m`
  }

  function renderRainbowLine(line: string, useTrueColor: boolean): string {
    // 7-color rainbow (ROYGCBV)
    const colorsRGB = [
      [255, 0, 0],
      [255, 127, 0],
      [255, 255, 0],
      [0, 255, 0],
      [0, 255, 255],
      [0, 0, 255],
      [139, 0, 255],
    ]
    const colorsANSI = [91, 93, 92, 96, 94, 95, 91]

    const runes = Array.from(line)
    const width = runes.length
    let out = ""
    for (let x = 0; x < width; x++) {
      const ch = runes[x]
      if (ch === " ") {
        out += " "
        continue
      }
      const idx = width > 1 ? Math.floor((x / (width - 1)) * (colorsRGB.length - 1)) : 0
      if (useTrueColor) {
        const [r, g, b] = colorsRGB[idx]
        out += rgbEsc(r, g, b) + ch
      } else {
        out += rainbowAnsi(colorsANSI[idx]) + ch
      }
    }
    return out + "\x1b[0m"
  }

  export function logo(pad?: string) {
    const result: string[] = []
    for (const row of LOGO) {
      if (pad) result.push(pad)
      result.push(row)
      result.push(EOL)
    }
    return result.join("").trimEnd()
  }

  export async function input(prompt: string): Promise<string> {
    const readline = require("readline")
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })

    return new Promise((resolve) => {
      rl.question(prompt, (answer: string) => {
        rl.close()
        resolve(answer.trim())
      })
    })
  }

  export function error(message: string) {
    println(Style.TEXT_DANGER_BOLD + "Error: " + Style.TEXT_NORMAL + message)
  }

  export function markdown(text: string): string {
    return text
  }
}
