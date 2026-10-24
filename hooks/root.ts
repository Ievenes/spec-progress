// The session may start in a sub-folder of the project (a spec's own folder, say):
// climb until the folder that holds `.specify/`, else the one that holds `specs/`.
// Paths are relative to the session's folder: '.' there, '..' one up, and so on.
export const findRoot = async (exists: (path: string) => Promise<boolean>): Promise<string> => {
  const up = (depth: number): string => (depth === 0 ? '.' : Array.from({ length: depth }, () => '..').join('/'))

  for (const marker of ['.specify', 'specs']) {
    for (let depth = 0; depth <= 5; depth++) {
      if (await exists(`${up(depth)}/${marker}`).catch(() => false)) return up(depth)
    }
  }

  return '.'
}

// `path` inside the project, as the session's folder reaches it.
export const at = (root: string, path: string): string => (root === '.' ? path : `${root}/${path}`)
