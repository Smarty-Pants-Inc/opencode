import z from "zod/v4"
import { Filesystem } from "../util/filesystem"
import path from "path"
import { $ } from "bun"
import { Storage } from "../storage/storage"
import { Log } from "../util/log"
import { createHash } from "crypto"

export namespace Project {
  const log = Log.create({ service: "project" })
  export const Info = z
    .object({
      id: z.string(),
      worktree: z.string(),
      vcs: z.literal("git").optional(),
      time: z.object({
        created: z.number(),
        initialized: z.number().optional(),
      }),
    })
    .meta({
      ref: "Project",
    })
  export type Info = z.infer<typeof Info>

  export async function fromDirectory(directory: string) {
    log.info("fromDirectory", { directory })
    const matches = Filesystem.up({ targets: [".git"], start: directory })
    const git = await matches.next().then((x) => x.value)
    await matches.return()
    if (!git) {
      const project: Info = {
        id: "global",
        worktree: "/",
        time: {
          created: Date.now(),
        },
      }
      await Storage.write<Info>(["project", "global"], project)
      return project
    }

    // Resolve canonical toplevel worktree path from the directory containing .git
    const startDir = path.dirname(git)
    let worktree = await $`git rev-parse --path-format=absolute --show-toplevel`
      .quiet()
      .nothrow()
      .cwd(startDir)
      .text()
      .then((x) => x.trim())

    // Prefer superproject working tree if this repository is a submodule
    const superproject = await $`git rev-parse --show-superproject-working-tree`
      .quiet()
      .nothrow()
      .cwd(worktree)
      .text()
      .then((x) => x.trim())
      .catch(() => "")
    if (superproject) {
      worktree = superproject
    }

    // Compute stable project id from the anchor worktree path
    const stableID = createHash("sha1").update(worktree).digest("hex")

    // Ensure a project record exists for the stable id
    let project: Info
    try {
      project = await Storage.read<Info>(["project", stableID])
    } catch {
      project = {
        id: stableID,
        worktree,
        vcs: "git",
        time: { created: Date.now() },
      }
      await Storage.write<Info>(["project", stableID], project)
    }
    return project
  }

  export async function setInitialized(projectID: string) {
    await Storage.update<Info>(["project", projectID], (draft) => {
      draft.time.initialized = Date.now()
    })
  }

  export async function list() {
    const keys = await Storage.list(["project"])
    return await Promise.all(keys.map((x) => Storage.read<Info>(x)))
  }
}
