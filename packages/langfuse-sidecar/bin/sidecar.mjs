#!/usr/bin/env node
/*
  opencode-langfuse-sidecar (v4, sidecar-only)
  - Listens to OPENCODE_EVENT_URL SSE
  - Builds one GENERATION per assistant message
  - Attaches streaming text/reasoning + tools as children
  - Finalizes on assistant message.updated (after step-finish) to include tokens/cost + provider/model
*/

import { NodeSDK } from "@opentelemetry/sdk-node"
import { LangfuseSpanProcessor } from "@langfuse/otel"
import { startObservation } from "@langfuse/tracing"
import { LangfuseClient } from "@langfuse/client"

function sanitizeText(t) {
  if (!t) return t
  const s = String(t)
  return s.length > 4000 ? s.slice(0, 4000) + "…" : s
}
function sanitizeFileUrl(u) {
  if (!u) return u
  return typeof u === "string" && u.startsWith("data:") ? "data:[omitted]" : u
}

const env = process.env
const eventUrl = env.OPENCODE_EVENT_URL || (env.OPENCODE_SERVER_PORT ? `http://127.0.0.1:${env.OPENCODE_SERVER_PORT}/event` : undefined)
if (!eventUrl) {
  console.error("[lf-sidecar] OPENCODE_EVENT_URL not set")
  process.exit(1)
}
if (!env.OTEL_SERVICE_NAME) env.OTEL_SERVICE_NAME = "opencode-sidecar"

const sdk = new NodeSDK({ spanProcessors: [new LangfuseSpanProcessor()] })
try { await sdk.start() } catch {}

const lf = new LangfuseClient({
  baseUrl: env.LANGFUSE_BASE_URL,
  publicKey: env.LANGFUSE_PUBLIC_KEY,
  secretKey: env.LANGFUSE_SECRET_KEY,
})

const serverOrigin = new URL(eventUrl).origin
async function log(level, message, extra) {
  try {
    await fetch(`${serverOrigin}/log`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ service: "langfuse.sidecar", level, message, extra }),
    })
  } catch {}
}

// State
const userBySession = new Map() // sessionID -> { messageID, text }
const genByMsg = new Map() // messageID -> { obs, out: string, providerID?: string, modelID?: string }
const stepObs = new Map() // stepID -> obs
const toolObs = new Map() // callID -> obs
const pending = new Map() // messageID -> { tokens, cost, finished }

function ensureGenerationForMessage(messageID, sessionID, meta) {
  let g = genByMsg.get(messageID)
  if (g) return g
  const inputText = userBySession.get(sessionID)?.text
  const obs = startObservation(
    "assistant",
    { input: inputText ? { text: sanitizeText(inputText) } : undefined, metadata: { messageID, ...meta } },
    { asType: "generation" },
  )
  try { obs.updateTrace({ sessionId: sessionID }) } catch {}
  g = { obs, out: "", providerID: meta?.providerID, modelID: meta?.modelID }
  genByMsg.set(messageID, g)
  return g
}

async function maybeFinalize(messageID, reason) {
  const g = genByMsg.get(messageID)
  const st = pending.get(messageID)
  if (!g || !st?.finished) return
  try {
    g.obs.update({
      output: sanitizeText(g.out || ""),
      usageDetails: {
        inputTokens: st.tokens?.input,
        outputTokens: st.tokens?.output,
        reasoningTokens: st.tokens?.reasoning,
        cacheReadInputTokens: st.tokens?.cache?.read,
      },
      costDetails: { totalCost: st.cost },
      metadata: { providerID: g.providerID, modelID: g.modelID },
    })
    g.obs.end()
    const traceId = g.obs.traceId
    let url
    try { if (traceId) url = await lf.getTraceUrl(traceId) } catch {}
    await log("info", "generation finalized", { messageID, traceId, url, reason })
  } catch (e) {
    await log("error", "finalize failed", { messageID, error: String(e) })
  } finally {
    genByMsg.delete(messageID)
    pending.delete(messageID)
  }
}

async function handle(ev) {
  const t = ev.type
  const p = ev.properties || {}
  const sid = p?.sessionID || p?.info?.sessionID || p?.part?.sessionID

  if (t === "message.part.updated" && p?.part) {
    const part = p.part

    if (part.type === "start-step" || part.type === "step-start") {
      // Create step span and ensure generation exists
      const g = ensureGenerationForMessage(part.messageID, sid)
      const s = g.obs.startObservation("step", {}, { asType: "span" })
      stepObs.set(part.id, s)
      return
    }

    if (part.type === "finish-step" || part.type === "step-finish") {
      // Close step (if any) and store tokens/cost; generation will be finalized on message.updated
      const s = stepObs.get(part.id)
      if (s) {
        try { s.update({ metadata: { tokens: part.tokens, cost: part.cost } }); s.end() } catch {}
        stepObs.delete(part.id)
      }
      const st = pending.get(part.messageID) || {}
      st.tokens = part.tokens
      st.cost = part.cost
      st.finished = true
      pending.set(part.messageID, st)
      return
    }

    if (part.type === "tool") {
      const g = genByMsg.get(part.messageID)
      const parent = g?.obs
      if (part.state.status === "pending" || part.state.status === "running") {
        const s = (parent ? parent.startObservation(`tool:${part.tool}`, { input: part.state.input, metadata: { callID: part.callID } }, { asType: "tool" }) : startObservation(`tool:${part.tool}`, { input: part.state.input, metadata: { callID: part.callID } }, { asType: "tool" }))
        toolObs.set(part.callID, s)
        return
      }
      if (part.state.status === "completed") {
        const s = toolObs.get(part.callID) || (parent ? parent.startObservation(`tool:${part.tool}`, {}, { asType: "tool" }) : startObservation(`tool:${part.tool}`, {}, { asType: "tool" }))
        try { s.update({ input: part.state.input, output: part.state.output, metadata: part.metadata }); s.end() } catch {}
        toolObs.delete(part.callID)
        return
      }
      if (part.state.status === "error") {
        const s = toolObs.get(part.callID) || (parent ? parent.startObservation(`tool:${part.tool}`, {}, { asType: "tool" }) : startObservation(`tool:${part.tool}`, {}, { asType: "tool" }))
        try { s.update({ input: part.state.input, output: { error: part.state.error }, metadata: part.metadata }); s.end() } catch {}
        toolObs.delete(part.callID)
        return
      }
      return
    }

    if (part.type === "text" || part.type === "text-start" || part.type === "text-delta" || part.type === "text-end") {
      // Accumulate into user or assistant generation
      if (sid) {
        const u = userBySession.get(sid)
        if (u && u.messageID === part.messageID) {
          u.text = (u.text || "") + String(part.text || "")
          userBySession.set(sid, u)
        }
      }
      const g = genByMsg.get(part.messageID)
      if (g) {
        g.out = (g.out || "") + String(part.text || "")
        try { const s = g.obs.startObservation("text", { input: { text: sanitizeText(part.text) }, metadata: { messageID: part.messageID } }, { asType: "event" }); s.end() } catch {}
      }
      return
    }

    if (part.type === "reasoning" || part.type === "reasoning-delta" || part.type === "reasoning-end") {
      const g = genByMsg.get(part.messageID)
      if (g) { try { const s = g.obs.startObservation("reasoning", { input: { text: sanitizeText(part.text) }, metadata: { ...part.metadata, messageID: part.messageID } }, { asType: "event" }); s.end() } catch {} }
      return
    }

    if (part.type === "file") {
      const g = genByMsg.get(part.messageID)
      if (g) { try { const s = g.obs.startObservation("file", { input: { mime: part.mime, filename: part.filename, url: sanitizeFileUrl(part.url) }, metadata: { messageID: part.messageID } }, { asType: "event" }); s.end() } catch {} }
      return
    }

    return
  }

  if (t === "message.updated" && p?.info) {
    const info = p.info
    if (info.role === "assistant") {
      const g = ensureGenerationForMessage(info.id, info.sessionID, { providerID: info.providerID, modelID: info.modelID })
      g.providerID = info.providerID
      g.modelID = info.modelID
      await maybeFinalize(info.id, "message.updated")
      return
    }
    if (info.role === "user") {
      userBySession.set(info.sessionID, { messageID: info.id, text: "" })
      return
    }
  }
}

async function connectSSE(url) {
  const res = await fetch(url, { headers: { Accept: "text/event-stream" } })
  if (!res.ok || !res.body) throw new Error(`SSE failed: ${res.status}`)
  const reader = res.body.getReader()
  const decoder = new TextDecoder("utf-8")
  let buf = ""

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })

    let idx
    while ((idx = buf.indexOf("\n\n")) >= 0) {
      const raw = buf.slice(0, idx)
      buf = buf.slice(idx + 2)
      const lines = raw.split(/\r?\n/)
      const data = lines.filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trimStart()).join("\n")
      if (!data) continue
      try { const ev = JSON.parse(data); await handle(ev) } catch {}
    }
  }
}

await log("info", "sidecar starting", { eventUrl })
try { await connectSSE(eventUrl) } catch (e) { await log("error", "sidecar crashed", { error: String(e) }); process.exit(1) }
