import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import { RunCommand } from "./cli/cmd/run"
import { GenerateCommand } from "./cli/cmd/generate"
import { Log } from "./util/log"
import { AuthCommand } from "./cli/cmd/auth"
import { AgentCommand } from "./cli/cmd/agent"
import { UpgradeCommand } from "./cli/cmd/upgrade"
import { ModelsCommand } from "./cli/cmd/models"
import { UI } from "./cli/ui"
import { Installation } from "./installation"
import { NamedError } from "./util/error"
import { FormatError } from "./cli/error"
import { ServeCommand } from "./cli/cmd/serve"
import { TuiCommand } from "./cli/cmd/tui"
import { DebugCommand } from "./cli/cmd/debug"
import { StatsCommand } from "./cli/cmd/stats"
import { McpCommand } from "./cli/cmd/mcp"
import { GithubCommand } from "./cli/cmd/github"
import { ExportCommand } from "./cli/cmd/export"
import { AttachCommand } from "./cli/cmd/attach"

// Langfuse integration (v4 via Node OTel only)
try {
  const env = process.env as Record<string, string | undefined>
  if (
    (env["OPENCODE_OBSERVE"] ?? "").includes("langfuse-app") &&
    env["LANGFUSE_SECRET_KEY"] &&
    env["LANGFUSE_PUBLIC_KEY"] &&
    typeof (globalThis as any).Bun === "undefined"
  ) {
    let initialized = false
    try {
      const { NodeSDK } = (await import("@opentelemetry/sdk-node")) as any
      const { LangfuseSpanProcessor } = (await import("@langfuse/otel")) as any
      const sdk = new NodeSDK({ spanProcessors: [new LangfuseSpanProcessor() as any] } as any)
      await sdk.start()
      initialized = true
    } catch {}

    if (!initialized) {
      try {
        const { BasicTracerProvider } = (await import("@opentelemetry/sdk-trace-base")) as any
        const { LangfuseSpanProcessor } = (await import("@langfuse/otel")) as any
        const provider = new BasicTracerProvider() as any
        provider.addSpanProcessor(new LangfuseSpanProcessor() as any)
        provider.register()
        initialized = true
      } catch {}
    }

    if (initialized) {
      try {
        const { startActiveObservation, startObservation, updateActiveTrace } = await import("@langfuse/tracing")
        const { Bus } = await import("./bus")

        const stepObs = new Map<string, any>()
        const toolObs = new Map<string, any>()

        Bus.subscribeAll((evt: any) =>
          startActiveObservation(`opencode:${evt.type}`, async () => {
            const p = evt?.properties as any
            const sid = p?.sessionID || p?.info?.sessionID || p?.part?.sessionID
            if (sid) {
              try {
                updateActiveTrace({ sessionId: String(sid) })
              } catch {}
            }
            const t = evt.type as string

            if (t === "message.part.updated" && p?.part) {
              const part = p.part as any
              if (part.type === "step-start") {
                const s = startObservation("step")
                stepObs.set(part.id, s)
                return
              }
              if (part.type === "step-finish") {
                const s = stepObs.get(part.id) ?? startObservation("step")
                s.update({ metadata: { tokens: part.tokens, cost: part.cost } })
                s.end()
                stepObs.delete(part.id)
                return
              }
              if (part.type === "tool") {
                if (part.state.status === "pending" || part.state.status === "running") {
                  const s = startObservation(`tool:${part.tool}`, {
                    input: part.state.input,
                    metadata: { callID: part.callID },
                  })
                  toolObs.set(part.callID, s)
                  return
                }
                if (part.state.status === "completed") {
                  const s = toolObs.get(part.callID) ?? startObservation(`tool:${part.tool}`)
                  s.update({ input: { input: part.state.input, output: part.state.output, meta: part.metadata } })
                  s.end()
                  toolObs.delete(part.callID)
                  return
                }
                if (part.state.status === "error") {
                  const s = toolObs.get(part.callID) ?? startObservation(`tool:${part.tool}`)
                  s.update({ input: { input: part.state.input, error: part.state.error, meta: part.metadata } })
                  s.end()
                  toolObs.delete(part.callID)
                  return
                }
              }
              if (part.type === "text") {
                const s = startObservation("text", { input: { text: part.text } })
                s.end()
                return
              }
              if (part.type === "reasoning") {
                const s = startObservation("reasoning", { input: { text: part.text }, metadata: part.metadata })
                s.end()
                return
              }
              if (part.type === "file") {
                const s = startObservation("file", {
                  input: { mime: part.mime, filename: part.filename, url: part.url },
                })
                s.end()
                return
              }
              const s = startObservation(part.type, { input: part })
              s.end()
              return
            }

            if (t === "message.updated" && p?.info) {
              const info = p.info as any
              if (info.role === "assistant") {
                const s = startObservation(
                  "assistant",
                  { metadata: { providerID: info.providerID, modelID: info.modelID } } as any,
                  { asType: "generation" } as any,
                )
                s.update({ metadata: { tokens: info.tokens, cost: info.cost } })
                s.end()
                return
              }
              if (info.role === "user") {
                const s = startObservation("user", { input: { time: info.time?.created } })
                s.end()
                return
              }
            }

            const s = startObservation(t, { input: p })
            s.end()
          }),
        )
      } catch {}
    }
  }
} catch {}

const cancel = new AbortController()

// Print logo explicitly before yargs help so leading spaces are preserved
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(UI.logo())
  console.log()
}

try {
} catch (e) {}

process.on("unhandledRejection", (e) => {
  Log.Default.error("rejection", {
    e: e instanceof Error ? e.message : e,
  })
})

process.on("uncaughtException", (e) => {
  Log.Default.error("exception", {
    e: e instanceof Error ? e.message : e,
  })
})

const cli = yargs(hideBin(process.argv))
  .scriptName("opencode")
  .help("help", "show help")
  .version("version", "show version number", Installation.VERSION)
  .alias("version", "v")
  .option("print-logs", {
    describe: "print logs to stderr",
    type: "boolean",
  })
  .option("log-level", {
    describe: "log level",
    type: "string",
    choices: ["DEBUG", "INFO", "WARN", "ERROR"],
  })
  .middleware(async (opts) => {
    await Log.init({
      print: process.argv.includes("--print-logs"),
      dev: Installation.isDev(),
      level: (() => {
        if (opts.logLevel) return opts.logLevel as Log.Level
        if (Installation.isDev()) return "DEBUG"
        return "INFO"
      })(),
    })

    process.env["OPENCODE"] = "1"

    Log.Default.info("opencode", {
      version: Installation.VERSION,
      args: process.argv.slice(2),
    })
  })
  .usage("")
  .command(McpCommand)
  .command(TuiCommand)
  .command(AttachCommand)
  .command(RunCommand)
  .command(GenerateCommand)
  .command(DebugCommand)
  .command(AuthCommand)
  .command(AgentCommand)
  .command(UpgradeCommand)
  .command(ServeCommand)
  .command(ModelsCommand)
  .command(StatsCommand)
  .command(ExportCommand)
  .command(GithubCommand)
  .fail((msg) => {
    if (
      msg.startsWith("Unknown argument") ||
      msg.startsWith("Not enough non-option arguments") ||
      msg.startsWith("Invalid values:")
    ) {
      console.error(UI.logo())
      cli.showHelp("log")
    }
    process.exit(1)
  })
  .strict()

try {
  await cli.parse()
} catch (e) {
  let data: Record<string, any> = {}
  if (e instanceof NamedError) {
    const obj = e.toObject()
    Object.assign(data, {
      ...obj.data,
    })
  }

  if (e instanceof Error) {
    Object.assign(data, {
      name: e.name,
      message: e.message,
      cause: e.cause?.toString(),
      stack: e.stack,
    })
  }

  if (e instanceof ResolveMessage) {
    Object.assign(data, {
      name: e.name,
      message: e.message,
      code: e.code,
      specifier: e.specifier,
      referrer: e.referrer,
      position: e.position,
      importKind: e.importKind,
    })
  }
  Log.Default.error("fatal", data)
  const formatted = FormatError(e)
  if (formatted) UI.error(formatted)
  if (formatted === undefined) UI.error("Unexpected error, check log file at " + Log.file() + " for more details")
  process.exitCode = 1
}

cancel.abort()
