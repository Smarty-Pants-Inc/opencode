import { describe, expect, test } from "bun:test"
import { GlobTool } from "../../src/tool/glob"
import { ListTool } from "../../src/tool/ls"
import path from "path"
import { Instance } from "../../src/project/instance"

const ctx = {
  sessionID: "test",
  messageID: "",
  toolCallID: "",
  agent: "build",
  abort: AbortSignal.any([]),
  metadata: () => {},
}
const glob = await GlobTool.init()
const list = await ListTool.init()

const projectRoot = path.join(__dirname, "../..")
// const fixturePath = path.join(__dirname, "../fixtures/example")

describe("tool.glob", () => {
  test("truncate", async () => {
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        let result = await glob.execute(
          {
            pattern: "**/*",
            path: "../../node_modules",
          },
          ctx,
        )
        expect(result.metadata.truncated).toBe(true)
      },
    })
  })
  test("basic", async () => {
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
let result = await glob.execute(
          {
            pattern: "*.md",
            // search from package root
          } as any,
          ctx,
        )
        expect(result.metadata.count).toBeGreaterThan(0)
        expect(result.output.includes("agents.md")).toBe(true)
      },
    })
  })
})

describe("tool.ls", () => {
  test("basic", async () => {
    const result = await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        // List from package root; will include fixtures tree
        return await list.execute({ path: undefined as any, ignore: [".git"] }, ctx)
      },
    })

    expect(result.metadata.count).toBeGreaterThan(0)
    expect(result.output.includes("agents.md")).toBe(true)
    expect(result.output.includes("claude.md")).toBe(true)
  })
})
