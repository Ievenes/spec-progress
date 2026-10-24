import type { Feature } from '../types'
import { fill } from './i18n'
import type { Strings } from './i18n'
import { brief } from './parse'
import { nextCommand } from './stages'

const IMPLEMENT = '/speckit-implement'

const join = (...parts: string[]): string => parts.filter(p => p !== '').join(' ')

// A warning when the phase waits on an earlier one that still has tasks left.
const warning = (t: Strings, f: Feature, label: string): string => {
  const blocker = f.phases.find(p => p.label === label)?.blockedBy

  return blocker ? fill(t.promptBlocked, { phase: label, blocker }) : ''
}

// What to put in the prompt box for the next pending task; null when none is left.
export const taskPrompt = (t: Strings, f: Feature): string | null => {
  if (!f.next) return null
  const task = fill(t.promptTask, { id: f.next.id, spec: f.id, text: brief(f.next.text, 140) })

  return join(IMPLEMENT, task, warning(t, f, f.next.phase))
}

// ...for a whole phase (the current one by default); null when it has no tasks left.
export const phasePrompt = (t: Strings, f: Feature, label: string | null = f.phase): string | null => {
  const phase = f.phases.find(p => p.label === label)
  if (!phase || phase.done === phase.total) return null
  const text = fill(t.promptPhase, { phase: phase.label, title: phase.title, spec: f.id })

  return join(IMPLEMENT, text, warning(t, f, phase.label))
}

// ...for the next task and the other [P] tasks of its phase; null when none can run beside it.
export const parallelPrompt = (t: Strings, f: Feature): string | null => {
  if (!f.next || f.parallel.length === 0) return null
  const text = fill(t.promptParallel, { ids: [f.next.id, ...f.parallel].join(', '), spec: f.id })

  return join(IMPLEMENT, text, warning(t, f, f.next.phase))
}

// The Spec Kit command for the step before implementation that is still open
// (/speckit-plan, /speckit-tasks…); null once the flow has reached the tasks.
export const flowCommand = (f: Feature): string | null => {
  const cmd = nextCommand(f.stages, f.done, f.total)

  return cmd === null || cmd === IMPLEMENT ? null : cmd
}
