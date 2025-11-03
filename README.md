<p align="center">
  <a href="https://opencode.ai">
    <picture>
      <source srcset="packages/console/app/src/asset/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="packages/console/app/src/asset/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="OpenCode logo">
    </picture>
  </a>
</p>
<p align="center">The AI coding agent built for the terminal.</p>
<p align="center">
  <a href="https://opencode.ai/discord"><img alt="Discord" src="https://img.shields.io/discord/1391832426048651334?style=flat-square&label=discord" /></a>
  <a href="https://www.npmjs.com/package/opencode-ai"><img alt="npm" src="https://img.shields.io/npm/v/opencode-ai?style=flat-square" /></a>
  <a href="https://github.com/sst/opencode/actions/workflows/publish.yml"><img alt="Build status" src="https://img.shields.io/github/actions/workflow/status/sst/opencode/publish.yml?style=flat-square&branch=dev" /></a>
</p>

[![OpenCode Terminal UI](packages/web/src/assets/lander/screenshot.png)](https://opencode.ai)

---

### Installation

```bash
# YOLO
curl -fsSL https://opencode.ai/install | bash

# Package managers
npm i -g opencode-ai@latest        # or bun/pnpm/yarn
scoop bucket add extras; scoop install extras/opencode  # Windows
choco install opencode             # Windows
brew install opencode      # macOS and Linux
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

For more info on how to configure OpenCode [**head over to our docs**](https://opencode.ai/docs).

### Contributing

If you're interested in contributing to OpenCode, please read our [contributing docs](./CONTRIBUTING.md) before submitting a pull request.

### FAQ

#### How is this different than Claude Code?

It's very similar to Claude Code in terms of capability. Here are the key differences:

- 100% open source
- Not coupled to any provider. Although Anthropic is recommended, OpenCode can be used with OpenAI, Google or even local models. As models evolve the gaps between them will close and pricing will drop so being provider-agnostic is important.
- Out of the box LSP support
- A focus on TUI. OpenCode is built by neovim users and the creators of [terminal.shop](https://terminal.shop); we are going to push the limits of what's possible in the terminal.
- A client/server architecture. This for example can allow OpenCode to run on your computer, while you can drive it remotely from a mobile app. Meaning that the TUI frontend is just one of the possible clients.

#### What's the other repo?

The other confusingly named repo has no relation to this one. You can [read the story behind it here](https://x.com/thdxr/status/1933561254481666466).

---

### Smarty Fork Policy (Branding Overlay)

This fork tracks upstream and applies only our branding on top.

- Default branch: `downstream/smarty` = `upstream/dev` + branding overlay
- Upstream remote: `upstream` → https://github.com/sst/opencode
- We do not maintain a separate fixes branch; fixes should be upstreamed

Common tasks:

- Rebase branding on latest upstream and push:
  - `scripts/opencode-branding-patch.sh --apply --push`
- Generate branding-only patch (for inspection):
  - `scripts/opencode-branding-patch.sh`
  - Output: `/tmp/branding-<timestamp>.patch` (not committed)
- Remove any accidentally committed large patches:
  - `scripts/opencode-branding-patch.sh --drop-large-patches`

What the branding patch includes:
- `packages/identity/**`
- `sdks/vscode/images/**`
- `packages/console/app/src/asset/**`
- `packages/opencode/src/cli/cmd/tui/context/theme/opencode.json` (TS TUI)
- `packages/tui/internal/theme/themes/opencode.json` (legacy Go TUI)
- `packages/web/public/**`
- `packages/app/src/assets/favicon.svg`
- `packages/app/src/ui/logo.tsx`

Notes:
- The script resets the branch to `upstream/dev` then reapplies only branding files, keeping history small and reproducible.
- CI workflow `.github/workflows/guidelines-check.yml` is kept as a small, separate commit on `downstream/smarty`.

---

**Join our community** [Discord](https://discord.gg/opencode) | [X.com](https://x.com/opencode)
