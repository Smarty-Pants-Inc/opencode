#!/usr/bin/env node
/*
  opencode-langfuse-sidecar (v4 only, Node)
  - Subscribes to opencode SSE event stream
  - Emits Langfuse v4 observations
*/

import { NodeSDK } from "@opentelemetry/sdk-node"
import { LangfuseSpanProcessor } from "@langfuse/otel"
import { startActiveObservation, startObservation, updateActiveTrace } from "@langfuse/tracing"

const LOG = (...args) => {
  if (process.env.LF_SIDECAR_LOG === "1") console.log("[lf-sidecar]", ...args)
}

async function initOtel() {
  const sdk = new NodeSDK({ spanProcessors: [new LangfuseSpanProcessor()] })
  try { await Promise.resolve(sdk.start()) } catch {}
}

function eventUrl() {
  const fromEnv = process.env.OPENCODE_EVENT_URL
  if (fromEnv) return fromEnv
  const host = process.env.OPENCODE_SERVER_HOST || "127.0.0.1"
  const port = process.env.OPENCODE_SERVER_PORT || "5088"
  return `http://${host}:${port}/event`
}

async function connectAndStream(url) {
  LOG("connecting", url)
  const res = await fetch(url, { headers: { Accept: "text/event-stream" } })
  if (!res.ok || !res.body) throw new Error(`bad response: ${res.status}`)

  const reader = res.body.getReader()
  const decoder = new TextDecoder("utf-8")
  let buf = ""

  const stepObs = new Map()
  const toolObs = new Map()

  function handle(ev) {
    const t = ev.type
    const p = ev.properties || {}
    const sid = p?.info?.id ?? p?.sessionID

    startActiveObservation(`opencode:${t}`, async () => {
      if (sid) {
        try { updateActiveTrace({ sessionId: String(sid) }) } catch {}
      }

      if (t === "message.part.updated" && p?.part) {
        const part = p.part
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
            const s = startObservation(`tool:${part.tool}`, { input: part.state.input, metadata: { callID: part.callID } })
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
          const s = startObservation("file", { input: { mime: part.mime, filename: part.filename, url: part.url } })
          s.end()
          return
        }
        const s = startObservation(part.type, { input: part })
        s.end()
        return
      }

      if (t === "message.updated" && p?.info) {
        const info = p.info
        if (info.role === "assistant") {
          const s = startObservation("assistant", { metadata: { providerID: info.providerID, modelID: info.modelID } })
          s.update({ input: { tokens: info.tokens, cost: info.cost } })
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
    })
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    let idx
    while ((idx = buf.indexOf("\n\n")) >= 0) {
      const raw = buf.slice(0, idx)
      buf = buf.slice(idx + 2)
      const lines = raw.split(/\r?\n/)
      const data = lines
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trimStart())
        .join("\n")
      if (!data) continue
      try {
        const ev = JSON.parse(data)
        handle(ev)
      } catch (e) {
        LOG("parse error", e)
      }
    }
  }
}

async function main() {
  if (!process.env.LANGFUSE_PUBLIC_KEY || !process.env.LANGFUSE_SECRET_KEY) {
    console.error("LANGFUSE_* env not set; exiting")
    process.exit(1)
  }
  await initOtel()
  let backoff = 1000
  const url = eventUrl()
  // reconnect loop
  for (;;) {
    try {
      await connectAndStream(url)
      backoff = 1000
    } catch (e) {
      LOG("stream error; retrying", e?.message || e)
      await new Promise((r) => setTimeout(r, backoff))
      backoff = Math.min(backoff * 2, 30000)
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
