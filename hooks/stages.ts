import type { Stages } from '../types'

export type StepKey = 'spec' | 'clarify' | 'plan' | 'tasks' | 'implement'
export type Step = { key: StepKey; state: 'done' | 'current' | 'todo' }

const KEYS: readonly StepKey[] = ['spec', 'clarify', 'plan', 'tasks', 'implement']
const COMMANDS: Record<StepKey, string> = {
  spec: '/speckit-specify',
  clarify: '/speckit-clarify',
  plan: '/speckit-plan',
  tasks: '/speckit-tasks',
  implement: '/speckit-implement',
}
const FENCE = /^\s*(?:```|~~~)/

// Checkboxes of a checklist file, leaving out the ones in fenced examples.
export const countChecks = (md: string): { done: number; total: number } => {
  let done = 0
  let total = 0
  let isFenced = false

  for (const line of md.split(/\r?\n/)) {
    if (FENCE.test(line)) {
      isFenced = !isFenced
      continue
    }
    const box = isFenced ? null : /^\s*-\s\[([ xX])\]/.exec(line)
    if (!box) continue
    total += 1
    if (box[1] !== ' ') done += 1
  }

  return { done, total }
}

export const countClarifications = (md: string): number => (md.match(/\[NEEDS CLARIFICATION/gi) ?? []).length

// Which steps of the flow the folder shows as finished, in order.
const flags = (s: Stages, done: number, total: number): boolean[] => [
  s.hasSpec,
  s.hasSpec && s.clarifications === 0,
  s.hasPlan,
  s.hasTasks && total > 0,
  total > 0 && done === total,
]

// The first unfinished step is the current one; later unfinished steps wait.
export const steps = (s: Stages, done: number, total: number): Step[] => {
  const finished = flags(s, done, total)
  const first = finished.indexOf(false)

  return KEYS.map((key, i) => ({
    key,
    state: finished[i] ? 'done' : i === first ? 'current' : 'todo',
  }))
}

// The Spec Kit command for the first unfinished step; null when everything is done.
export const nextCommand = (s: Stages, done: number, total: number): string | null => {
  const first = flags(s, done, total).indexOf(false)

  return first < 0 ? null : COMMANDS[KEYS[first] as StepKey]
}
