<p align="center">
  <a href="https://opencode.ai">
    <picture>
      <source srcset="packages/web/src/assets/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="packages/web/src/assets/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src="packages/web/src/assets/logo-ornate-light.svg" alt="smartypants logo">
    </picture>
  </a>
</p>
<p align="center">AI coding agent, built for the terminal.</p>
<p align="center">
  <a href="https://opencode.ai/discord"><img alt="Discord" src="https://img.shields.io/discord/1391832426048651334?style=flat-square&label=discord" /></a>
  <a href="https://www.npmjs.com/package/opencode-ai"><img alt="npm" src="https://img.shields.io/npm/v/opencode-ai?style=flat-square" /></a>
  <a href="https://github.com/sst/opencode/actions/workflows/publish.yml"><img alt="Build status" src="https://img.shields.io/github/actions/workflow/status/sst/opencode/publish.yml?style=flat-square&branch=dev" /></a>
</p>

[![opencode Terminal UI](packages/web/src/assets/lander/screenshot.png)](https://opencode.ai)

---

### Installation

```bash
# YOLO
curl -fsSL https://opencode.ai/install | bash

# Package managers
npm i -g opencode-ai@latest        # or bun/pnpm/yarn
brew install sst/tap/opencode      # macOS and Linux
paru -S opencode-bin               # Arch Linux
```

> [!TIP]
> Remove versions older than 0.1.x before installing.

#### Installation Directory

The install script respects the following priority order for the installation path:

1. `$OPENCODE_INSTALL_DIR` - Custom installation directory
2. `$XDG_BIN_DIR` - XDG Base Directory Specification compliant path
3. `$HOME/bin` - Standard user binary directory (if exists or can be created)
4. `$HOME/.opencode/bin` - Default fallback

```bash
# Examples
OPENCODE_INSTALL_DIR=/usr/local/bin curl -fsSL https://opencode.ai/install | bash
XDG_BIN_DIR=$HOME/.local/bin curl -fsSL https://opencode.ai/install | bash
```

### Smarty Pants Fork Enhancements

This fork adds production-oriented observability, reliability, and UX improvements tailored for Smarty Pants. Highlights:

- Langfuse Observability (Sidecar v4): End-to-end tracing wired through a lightweight Node sidecar that listens to the server’s SSE stream and emits Langfuse GENERATION/TOOL/EVENT spans.
  - Server auto-starts the sidecar (env-gated via `OPENCODE_OBSERVE=langfuse`), and exposes an `/event` SSE feed.
  - Session-rooted traces: One root per session; per-assistant message generations are nested for clarity.
  - Output batching: Streaming deltas are aggregated and stored as a single generation output (no word-per-span noise).
  - Reasoning only when present: Emits a single reasoning event only if the model returns reasoning/tokens.
  - Canonical URLs: Finalized trace URL logged back to the server for downstream UIs.

- TUI Integration:
  - Status bar shows a Langfuse hyperlink; right-aligned near the tab strip with padding.
  - New “/trace” slash command opens the latest trace URL directly from the TUI.
  - Exit reliability improvements: fixes to ensure the UI and background goroutines shut down cleanly.

- Server/CLI Reliability:
  - Sidecar port fix: sidecar connects to the server’s actual bound port (works with `--port 0`).
  - `/event` SSE stream logs connection/disconnect and publishes bus events.
  - `run` command prints final assistant text to stdout and exits with explicit status.

- Dev Experience & Guardrails:
  - Observability is opt-in via `OPENCODE_OBSERVE` gates (`langfuse` or `langfuse-app`).
  - Reasonable defaults for secrets/env; clean shutdown for the sidecar (OTel `sdk.shutdown()`).

See commit history for detailed changes:

- observe(sidecar): session-rooted traces, output aggregation, reasoning gating
- server: sidecar autostart + SSE feed; port detection fixes
- tui: status bar hyperlink, `/trace` command, clean exit behavior
- cli: robust `run` printing + explicit exit codes

### Documentation

For more info on how to configure opencode [**head over to our docs**](https://opencode.ai/docs).

### Contributing

opencode is an opinionated tool so any fundamental feature needs to go through a
design process with the core team.

> [!IMPORTANT]
> We do not accept PRs for core features.

However we still merge a ton of PRs - you can contribute:

- Bug fixes
- Improvements to LLM performance
- Support for new providers
- Fixes for env specific quirks
- Missing standard behavior
- Documentation

Take a look at the git history to see what kind of PRs we end up merging.

> [!NOTE]
> If you do not follow the above guidelines we might close your PR.

To run opencode locally you need.

- Bun
- Golang 1.24.x

And run.

```bash
$ bun install
$ bun dev
```

#### Development Notes

**API Client**: After making changes to the TypeScript API endpoints in `packages/opencode/src/server/server.ts`, you will need the opencode team to generate a new stainless sdk for the clients.

### FAQ

#### How is this different than Claude Code?

It's very similar to Claude Code in terms of capability. Here are the key differences:

- 100% open source
- Not coupled to any provider. Although Anthropic is recommended, opencode can be used with OpenAI, Google or even local models. As models evolve the gaps between them will close and pricing will drop so being provider-agnostic is important.
- A focus on TUI. opencode is built by neovim users and the creators of [terminal.shop](https://terminal.shop); we are going to push the limits of what's possible in the terminal.
- A client/server architecture. This for example can allow opencode to run on your computer, while you can drive it remotely from a mobile app. Meaning that the TUI frontend is just one of the possible clients.

#### What's the other repo?

The other confusingly named repo has no relation to this one. You can [read the story behind it here](https://x.com/thdxr/status/1933561254481666466).

---

**Join our community** [Discord](https://discord.gg/opencode) | [X.com](https://x.com/opencode)
