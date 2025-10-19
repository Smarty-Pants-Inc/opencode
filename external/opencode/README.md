
## Local Wrapper Commands (Fork Usage)

In this fork, use a local wrapper command that runs the latest code from our worktrees in `smarty-dev`:

- `opencode-fixes` → `<repo-root>/.worktrees/opencode-fixes` (branch: `downstream/fixes`)


Wrappers live in `smarty-dev/scripts/` and are exposed on PATH via `~/.local/bin` symlinks:

```bash
ln -sf /Users/paulbettner/Projects/smarty-dev/scripts/opencode-fixes ~/.local/bin/opencode-fixes

```

Features:
- `--where`: print worktree, branch, and commit
- `--switch`: safely switch to the expected branch (refuses if dirty)
- ff‑only update (no `reset --hard`)

Usage:
```bash
opencode-fixes --where

opencode-fixes --switch

opencode-fixes run "whats 2+2?"   # "4" (LLM latency expected)
```

Temporarily flip to a different worktree while developing:
- Run the CLI directly from a worktree (no PATH change):
  ```bash
  bun --cwd /Users/paulbettner/Projects/smarty-dev/.worktrees/opencode-fixes/packages/opencode ./src/index.ts …
  
  ```
- Or repoint the symlink temporarily (and restore afterward):
  ```bash
  ln -sf /path/to/dev-wrapper ~/.local/bin/opencode-fixes
  ln -sf /Users/paulbettner/Projects/smarty-dev/scripts/opencode-fixes ~/.local/bin/opencode-fixes
  ```

Tip (zsh): add `typeset -U path PATH` to `~/.zshrc` to deduplicate PATH so `which -a` doesn't repeat the same location.
