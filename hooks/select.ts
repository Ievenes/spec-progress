import type { Feature, Hint } from '../types'

export type Source = 'pinned' | Hint['source'] | 'edited' | 'first'

export type Pick = { feature: Feature; source: Source }

const lastSegment = (value: string): string => value.split(/[\\/]/).pop() ?? value

// A hint names a spec by its folder ("specs/001-x"), its id or a branch
// ("feature/001-x"): the full value first, then its last segment.
export const matchSpec = (list: Feature[], value: string): Feature | undefined => {
  const v = value.trim().replace(/[\\/]+$/, '')
  if (v === '') return undefined

  return list.find(f => f.id === v) ?? list.find(f => f.id === lastSegment(v))
}

// What the person typed after /tasks-progress: an id, or the start of one ("002").
export const matchArg = (list: Feature[], query: string): Feature | undefined => {
  const q = query.trim().toLowerCase()
  if (q === '') return undefined

  return (
    list.find(f => f.id.toLowerCase() === q) ??
    list.find(f => f.id.toLowerCase().startsWith(q)) ??
    list.find(f => f.id.toLowerCase().includes(q))
  )
}

// Pinned, then what the project says (env, feature.json, branch), then the last
// spec edited this session, then the first one with work left, then the last.
export const pickActive = (
  list: Feature[],
  state: { pinned: string | null; hints: Hint[]; edited: string | null },
): Pick | undefined => {
  const pinned = state.pinned === null ? undefined : list.find(f => f.id === state.pinned)
  if (pinned) return { feature: pinned, source: 'pinned' }

  for (const hint of state.hints) {
    const hit = matchSpec(list, hint.value)
    if (hit) return { feature: hit, source: hint.source }
  }

  const edited = state.edited === null ? undefined : list.find(f => f.id === state.edited)
  if (edited) return { feature: edited, source: 'edited' }

  // A spec with no tasks yet still has work ahead of it.
  const first = list.find(f => f.done < f.total || f.total === 0)
  if (first) return { feature: first, source: 'first' }

  const last = list[list.length - 1]

  return last ? { feature: last, source: 'first' } : undefined
}

// `.specify/feature.json`: { "feature_directory": "specs/001-x" }
export const featureDirOf = (json: string): string | null => {
  try {
    const dir = (JSON.parse(json) as { feature_directory?: unknown }).feature_directory

    return typeof dir === 'string' && dir.trim() !== '' ? dir.trim() : null
  } catch {
    return null
  }
}

// `.git/HEAD`: "ref: refs/heads/feature/001-x" -> "feature/001-x"; a detached HEAD has none.
export const branchOf = (head: string): string | null => /^ref:\s*refs\/heads\/(.+?)\s*$/m.exec(head)?.[1] ?? null
