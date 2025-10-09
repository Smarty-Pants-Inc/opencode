<p align="center">
  <a href="https://opencode.ai">
    <picture>
      <source srcset="packages/web/src/assets/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="packages/web/src/assets/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src="packages/web/src/assets/logo-ornate-light.svg" alt="opencode logo">
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

## Smarty‑Pants Fork: Local Wrapper Commands

This repo configures two local wrapper commands that always run the latest code from our worktrees:

- `opencode-fixes` → `.worktrees/opencode-fixes` (branch: `downstream/fixes`)
- `smarty` → `.worktrees/opencode-smarty` (branch: `downstream/smarty`)

They are installed as wrappers in `scripts/` and exposed on PATH via `~/.local/bin` symlinks:

- `~/.local/bin/opencode-fixes` → `<repo>/scripts/opencode-fixes`
- `~/.local/bin/smarty` → `<repo>/scripts/smarty`

Both wrappers provide:
- `--where`: print the worktree path, branch, and commit
- `--switch`: safely switch the worktree to the expected branch (refuses if dirty)
- Non‑destructive fast‑forward (`ff-only`) — no `reset --hard`, no clobbering

Examples

```bash
opencode-fixes --where     # verify worktree + branch
smarty --where

opencode-fixes --switch    # align to downstream/fixes (requires clean worktree)
smarty --switch            # align to downstream/smarty

# Non‑interactive single‑shot runs (model latency expected)
opencode-fixes run "whats 2+2?"
smarty run "whats 2+2?"
```

Single source of truth + easy flips
- Single source of truth: keep the wrappers in `<repo>/scripts/` and ensure they’re first on PATH via `~/.local/bin` symlinks.
- Flip temporarily while developing in another worktree:
  - Option A (one‑off): run the CLI directly from a worktree:
    ```bash
    bun --cwd .worktrees/opencode-fixes/packages/opencode ./src/index.ts …
    bun --cwd .worktrees/opencode-smarty/packages/smartypants ./src/index.ts …
    ```
  - Option B (short‑term): repoint the symlink, then restore:
    ```bash
    ln -sf /path/to/dev-wrapper ~/.local/bin/opencode-fixes   # flip
    ln -sf "$PWD/scripts/opencode-fixes" ~/.local/bin/opencode-fixes  # restore
    ```

Tip: In zsh, `typeset -U path PATH` in `~/.zshrc` deduplicates PATH so `which -a` won’t show the same entry multiple times.
