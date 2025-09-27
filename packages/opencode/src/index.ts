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
        Bus.subscribeAll((evt: any) => {
          const sid = evt?.properties?.info?.id ?? evt?.properties?.sessionID
          const trace = lf.trace({ name: `opencode:${evt.type}` as string, sessionId: sid ? String(sid) : undefined, metadata: { event: evt.type } as any, input: evt.properties as any })
          const span = trace.span({ name: "event" })
          span.event({ name: "data", input: evt.properties as any })
          span.end()
        })
        process.on("beforeExit", async () => {
          try { await lf.flushAsync() } catch {}
        })
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
