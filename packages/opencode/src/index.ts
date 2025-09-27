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

// Langfuse integration (env-gated, graceful under Bun)
try {
  const env = process.env as Record<string, string | undefined>
  if (env.LANGFUSE_SECRET_KEY && env.LANGFUSE_PUBLIC_KEY) {
    const isBun = typeof (globalThis as any).Bun !== "undefined"
    if (isBun) {
      try {
        const { Bus } = await import("./bus")
        const { Langfuse } = await import("langfuse")
        const lf = new Langfuse({ publicKey: env.LANGFUSE_PUBLIC_KEY!, secretKey: env.LANGFUSE_SECRET_KEY!, baseUrl: env.LANGFUSE_BASE_URL })

        const traces = new Map<string, any>()
        const stepSpans = new Map<string, any>() // key: part.id
        const toolSpans = new Map<string, any>() // key: callID
        const messageSpans = new Map<string, any>() // key: messageID

        function getTrace(sessionID?: string) {
          if (sessionID) {
            const sid = String(sessionID)
            let t = traces.get(sid)
            if (!t) {
              t = lf.trace({ name: "opencode:session", sessionId: sid })
              traces.set(sid, t)
            }
            return t
          }
          return lf.trace({ name: "opencode:orphan" })
        }

        Bus.subscribeAll((evt: any) => {
          try {
            const sid = evt?.properties?.info?.id ?? evt?.properties?.sessionID
            const trace = getTrace(sid)
            const t = evt.type as string
            const p = evt.properties as any

            if (t === "message.part.updated" && p?.part) {
              const part = p.part as any
              if (part.type === "step-start") {
                const s = trace.span({ name: "step", metadata: { messageID: part.messageID } })
                stepSpans.set(part.id, s)
                return
              }
              if (part.type === "step-finish") {
                const s = stepSpans.get(part.id) ?? trace.span({ name: "step" })
                s.event({ name: "finish", input: { tokens: part.tokens, cost: part.cost } })
                s.end()
                stepSpans.delete(part.id)
                return
              }
              if (part.type === "tool") {
                if (part.state.status === "pending" || part.state.status === "running") {
                  const s = trace.span({ name: `tool:${part.tool}`, input: part.state.input, metadata: { callID: part.callID } })
                  toolSpans.set(part.callID, s)
                  return
                }
                if (part.state.status === "completed") {
                  const s = toolSpans.get(part.callID) ?? trace.span({ name: `tool:${part.tool}` })
                  s.event({ name: "result", input: { input: part.state.input, output: part.state.output, meta: part.metadata } })
                  s.end()
                  toolSpans.delete(part.callID)
                  return
                }
                if (part.state.status === "error") {
                  const s = toolSpans.get(part.callID) ?? trace.span({ name: `tool:${part.tool}` })
                  s.event({ name: "error", input: { input: part.state.input, error: part.state.error, meta: part.metadata } })
                  s.end()
                  toolSpans.delete(part.callID)
                  return
                }
              }
              if (part.type === "text") {
                const s = trace.span({ name: "text", metadata: { messageID: part.messageID } })
                s.event({ name: "chunk", input: { text: part.text } })
                s.end()
                return
              }
              if (part.type === "reasoning") {
                const s = trace.span({ name: "reasoning", metadata: { messageID: part.messageID } })
                s.event({ name: "chunk", input: { text: part.text, meta: part.metadata } })
                s.end()
                return
              }
              if (part.type === "file") {
                const s = trace.span({ name: "file", metadata: { messageID: part.messageID } })
                s.event({ name: "attached", input: { mime: part.mime, filename: part.filename, url: part.url } })
                s.end()
                return
              }
              // snapshot, patch, agent
              const s = trace.span({ name: part.type, metadata: { messageID: part.messageID } })
              s.event({ name: "data", input: part })
              s.end()
              return
            }

            if (t === "message.updated" && p?.info) {
              const info = p.info as any
              const key = info.id
              if (info.role === "assistant") {
                const s = trace.span({ name: "assistant", metadata: { providerID: info.providerID, modelID: info.modelID } })
                s.event({ name: "tokens", input: info.tokens })
                s.event({ name: "cost", input: info.cost })
                s.end()
                messageSpans.set(key, s)
                return
              }
              if (info.role === "user") {
                const s = trace.span({ name: "user" })
                s.event({ name: "created", input: { time: info.time?.created } })
                s.end()
                messageSpans.set(key, s)
                return
              }
            }

            // default: record generic event
            const s = trace.span({ name: t })
            s.event({ name: "data", input: p })
            s.end()
          } catch {}
        })

        // Wrap global fetch to instrument outgoing HTTP requests (exclude Langfuse)
        try {
          const originalFetch = globalThis.fetch
          globalThis.fetch = (async (...args: any[]) => {
            const input = args[0]
            const init = args[1] || {}
            const url = typeof input === "string" ? input : input?.url
            if (typeof url === "string" && url.includes("langfuse")) {
              return await (originalFetch as any)(...args)
            }
            const trace = getTrace()
            const s = trace.span({ name: "http.request", metadata: { url } })
            try {
              s.event({ name: "request", input: { method: init?.method || (typeof input !== "string" ? input?.method : undefined) } })
              const res = await (originalFetch as any)(...args)
              s.event({ name: "response", input: { status: res?.status } })
              s.end()
              return res
            } catch (e) {
              s.event({ name: "error", input: { error: String(e) } })
              s.end()
              throw e
            }
          }) as any
        } catch {}

        const flush = async () => { try { await lf.flushAsync() } catch {} }
        process.on("beforeExit", flush)
        process.on("exit", flush)
      } catch {}
    } else {
      let initialized = false
      try {
        const { NodeSDK } = await import("@opentelemetry/sdk-node")
        const { LangfuseSpanProcessor } = await import("@langfuse/otel")
        const sdk = new NodeSDK({ spanProcessors: [new LangfuseSpanProcessor({ exportMode: "immediate" })] })
        await sdk.start()
        initialized = true
      } catch {}

      if (!initialized) {
        try {
          const { BasicTracerProvider } = await import("@opentelemetry/sdk-trace-base")
          const { LangfuseSpanProcessor } = await import("@langfuse/otel")
          const provider = new BasicTracerProvider()
          provider.addSpanProcessor(new LangfuseSpanProcessor({ exportMode: "immediate" }))
          provider.register()
          initialized = true
        } catch {}
      }

      if (initialized) {
        try {
          const { startActiveObservation, updateActiveTrace } = await import("@langfuse/tracing")
          const { Bus } = await import("./bus")
          Bus.subscribeAll((evt: any) =>
            startActiveObservation(`opencode:${evt.type}`, async (span: any) => {
              const sid = evt?.properties?.info?.id ?? evt?.properties?.sessionID
              if (sid) {
                try { updateActiveTrace({ sessionId: String(sid) }) } catch {}
              }
              span.update({
                input: evt.properties,
                metadata: { sessionID: sid },
              })
            }),
          )
        } catch {}
      }
    }
  }
} catch {}

const cancel = new AbortController()

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
  .usage("\n" + UI.logo())
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
