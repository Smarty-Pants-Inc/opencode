import { Log } from "../util/log"
import path from "path"
import fs from "fs/promises"
import { Global } from "../global"
import { lazy } from "../util/lazy"
import { Lock } from "../util/lock"
import { $ } from "bun"
import { createHash } from "crypto"

export namespace Storage {
  const log = Log.create({ service: "storage" })

  type Migration = (dir: string) => Promise<void>

  const MIGRATIONS: Migration[] = [
    async (dir) => {
      const project = path.resolve(dir, "../project")
      for await (const projectDir of new Bun.Glob("*").scan({
        cwd: project,
        onlyFiles: false,
      })) {
        log.info(`migrating project ${projectDir}`)
        let projectID = projectDir
        const fullProjectDir = path.join(project, projectDir)
        let worktree = "/"

        if (projectID !== "global") {
          for await (const msgFile of new Bun.Glob("storage/session/message/*/*.json").scan({
            cwd: path.join(project, projectDir),
            absolute: true,
          })) {
            const json = await Bun.file(msgFile).json()
            worktree = json.path?.root
            if (worktree) break
          }
          if (!worktree) continue
          if (!(await fs.exists(worktree))) continue
          const [id] = await $`git rev-list --max-parents=0 --all`
            .quiet()
            .nothrow()
            .cwd(worktree)
            .text()
            .then((x) =>
              x
                .split("\n")
                .filter(Boolean)
                .map((x) => x.trim())
                .toSorted(),
            )
          if (!id) continue
          projectID = id

          await Bun.write(
            path.join(dir, "project", projectID + ".json"),
            JSON.stringify({
              id,
              vcs: "git",
              worktree,
              time: {
                created: Date.now(),
                initialized: Date.now(),
              },
            }),
          )

          log.info(`migrating sessions for project ${projectID}`)
          for await (const sessionFile of new Bun.Glob("storage/session/info/*.json").scan({
            cwd: fullProjectDir,
            absolute: true,
          })) {
            const dest = path.join(dir, "session", projectID, path.basename(sessionFile))
            log.info("copying", {
              sessionFile,
              dest,
            })
            const session = await Bun.file(sessionFile).json()
            await Bun.write(dest, JSON.stringify(session))
            log.info(`migrating messages for session ${session.id}`)
            for await (const msgFile of new Bun.Glob(`storage/session/message/${session.id}/*.json`).scan({
              cwd: fullProjectDir,
              absolute: true,
            })) {
              const dest = path.join(dir, "message", session.id, path.basename(msgFile))
              log.info("copying", {
                msgFile,
                dest,
              })
              const message = await Bun.file(msgFile).json()
              await Bun.write(dest, JSON.stringify(message))

              log.info(`migrating parts for message ${message.id}`)
              for await (const partFile of new Bun.Glob(`storage/session/part/${session.id}/${message.id}/*.json`).scan(
                {
                  cwd: fullProjectDir,
                  absolute: true,
                },
              )) {
                const dest = path.join(dir, "part", message.id, path.basename(partFile))
                const part = await Bun.file(partFile).json()
                log.info("copying", {
                  partFile,
                  dest,
                })
                await Bun.write(dest, JSON.stringify(part))
              }
            }
          }
        }
      }
    },
    // Consolidate sessions from any existing project IDs pointing to the same worktree into the hashed id
    async (dir) => {
      try {
        const projectsDir = path.join(dir, "project")
        // Build map: worktree -> set of projectIDs
        const map = new Map<string, Set<string>>()
        for await (const p of new Bun.Glob("*.json").scan({ cwd: projectsDir, absolute: true })) {
          try {
            const j = await Bun.file(p).json()
            if (!j?.worktree || !j?.id) continue
            const set = map.get(j.worktree) ?? new Set<string>()
            set.add(j.id)
            map.set(j.worktree, set)
          } catch {}
        }
        for (const [worktree, ids] of map) {
          const stable = createHash("sha1").update(worktree).digest("hex")
          // Ensure stable project record exists
          const stablePath = path.join(projectsDir, stable + ".json")
          try {
            await fs.access(stablePath)
          } catch {
            await Bun.write(
              stablePath,
              JSON.stringify({ id: stable, vcs: "git", worktree, time: { created: Date.now() } }),
            )
          }
          // Merge sessions from all ids into stable
          for (const id of ids) {
            if (id === stable) continue
            const srcDir = path.join(dir, "session", id)
            const dstDir = path.join(dir, "session", stable)
            try {
              await fs.mkdir(dstDir, { recursive: true })
            } catch {}
            for await (const f of new Bun.Glob("*.json").scan({ cwd: srcDir, absolute: true })) {
              const dest = path.join(dstDir, path.basename(f))
              try {
                await fs.access(dest)
              } catch {
                try {
                  await fs.copyFile(f, dest)
                } catch {}
              }
            }
          }
        }
      } catch (e) {
        log.error("failed consolidation migration", { error: e })
      }
    },
    // Fallback: if we have sessions under session/<legacyID> but no project mapping, infer worktree from session info (prefer superproject)
    async (dir) => {
      try {
        const sessionsRoot = path.join(dir, "session")
        for await (const proj of new Bun.Glob("*").scan({ cwd: sessionsRoot, onlyFiles: false })) {
          const legacyID = proj
          if (!legacyID || legacyID === "global") continue
          const srcDir = path.join(sessionsRoot, legacyID)
          let inferredWorktree = ""
          for await (const sf of new Bun.Glob("*.json").scan({ cwd: srcDir, absolute: true })) {
            try {
              const session = await Bun.file(sf).json()
              const directory = session?.directory as string | undefined
              if (!directory) continue
              const supertree = await $`git rev-parse --show-superproject-working-tree`.quiet().nothrow().cwd(directory).text().then((x) => x.trim()).catch(() => "")
              if (supertree) {
                inferredWorktree = supertree
                break
              }
              const wt = await $`git rev-parse --path-format=absolute --show-toplevel`.quiet().nothrow().cwd(directory).text().then((x) => x.trim()).catch(() => "")
              if (wt) {
                inferredWorktree = wt
                break
              }
            } catch {}
          }
          if (!inferredWorktree) continue
          const stable = createHash("sha1").update(inferredWorktree).digest("hex")
          const projectsDir = path.join(dir, "project")
          try {
            await fs.access(path.join(projectsDir, stable + ".json"))
          } catch {
            await fs.mkdir(projectsDir, { recursive: true }).catch(() => {})
            await Bun.write(
              path.join(projectsDir, stable + ".json"),
              JSON.stringify({ id: stable, vcs: "git", worktree: inferredWorktree, time: { created: Date.now() } }),
            )
          }
          const dstDir = path.join(sessionsRoot, stable)
          await fs.mkdir(dstDir, { recursive: true }).catch(() => {})
          for await (const f of new Bun.Glob("*.json").scan({ cwd: srcDir, absolute: true })) {
            const dest = path.join(dstDir, path.basename(f))
            try {
              await fs.access(dest)
            } catch {
              try {
                await fs.copyFile(f, dest)
              } catch {}
            }
          }
        }
      } catch (e) {
        log.error("failed fallback session migration", { error: e })
      }
    },
    // Consolidate submodule project IDs into superproject project ID
    async (dir) => {
      try {
        const projectsDir = path.join(dir, "project")
        for await (const p of new Bun.Glob("*.json").scan({ cwd: projectsDir, absolute: true })) {
          try {
            const j = await Bun.file(p).json()
            const worktree = j?.worktree as string | undefined
            const id = j?.id as string | undefined
            if (!worktree || !id) continue
            const supertree = await $`git rev-parse --show-superproject-working-tree`.quiet().nothrow().cwd(worktree).text().then((x) => x.trim()).catch(() => "")
            if (!supertree) continue
            const superID = createHash("sha1").update(supertree).digest("hex")
            // Ensure superproject record exists
            const superPath = path.join(projectsDir, superID + ".json")
            try {
              await fs.access(superPath)
            } catch {
              await Bun.write(
                superPath,
                JSON.stringify({ id: superID, vcs: "git", worktree: supertree, time: { created: Date.now() } }),
              )
            }
            // Copy sessions from submodule project ID to superproject project ID (id -> superID)
            const srcDir = path.join(dir, "session", id)
            const dstDir = path.join(dir, "session", superID)
            await fs.mkdir(dstDir, { recursive: true }).catch(() => {})
            for await (const f of new Bun.Glob("*.json").scan({ cwd: srcDir, absolute: true })) {
              const dest = path.join(dstDir, path.basename(f))
              try {
                await fs.access(dest)
              } catch {
                try {
                  await fs.copyFile(f, dest)
                } catch {}
              }
            }
          } catch {}
        }
      } catch (e) {
        log.error("failed superproject consolidation migration", { error: e })
      }
    },
  ]

  const state = lazy(async () => {
    const dir = path.join(Global.Path.data, "storage")
    const migration = await Bun.file(path.join(dir, "migration"))
      .json()
      .then((x) => parseInt(x))
      .catch(() => 0)
    for (let index = migration; index < MIGRATIONS.length; index++) {
      log.info("running migration", { index })
      const migration = MIGRATIONS[index]
      await migration(dir).catch((e) => {
        log.error("failed to run migration", { error: e, index })
      })
      await Bun.write(path.join(dir, "migration"), (index + 1).toString())
    }
    return {
      dir,
    }
  })

  export async function remove(key: string[]) {
    const dir = await state().then((x) => x.dir)
    const target = path.join(dir, ...key) + ".json"
    await fs.unlink(target).catch(() => {})
  }

  export async function read<T>(key: string[]) {
    const dir = await state().then((x) => x.dir)
    const target = path.join(dir, ...key) + ".json"
    using _ = await Lock.read(target)
    return Bun.file(target).json() as Promise<T>
  }

  export async function update<T>(key: string[], fn: (draft: T) => void) {
    const dir = await state().then((x) => x.dir)
    const target = path.join(dir, ...key) + ".json"
    using _ = await Lock.write("storage")
    const content = await Bun.file(target).json()
    fn(content)
    await Bun.write(target, JSON.stringify(content, null, 2))
    return content as T
  }

  export async function write<T>(key: string[], content: T) {
    const dir = await state().then((x) => x.dir)
    const target = path.join(dir, ...key) + ".json"
    using _ = await Lock.write("storage")
    await Bun.write(target, JSON.stringify(content, null, 2))
  }

  const glob = new Bun.Glob("**/*")
  export async function list(prefix: string[]) {
    const dir = await state().then((x) => x.dir)
    try {
      const result = await Array.fromAsync(
        glob.scan({
          cwd: path.join(dir, ...prefix),
          onlyFiles: true,
        }),
      ).then((results) => results.map((x) => [...prefix, ...x.slice(0, -5).split(path.sep)]))
      result.sort()
      return result
    } catch {
      return []
    }
  }
}
