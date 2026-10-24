export type Task = {
  id: string
  text: string
  isParallel: boolean
  isDone: boolean
  // Label of the phase and of the "###" group the task sits in.
  phase: string
  group: string | null
  // Files the text names between code ticks, with "/" separators.
  files: string[]
}

export type Group = {
  // "2A", or the first words of the heading.
  label: string
  done: number
  total: number
}

export type Phase = {
  // Short name for the stepper: "Setup", "US1".
  label: string
  // What the heading says after "Phase N:", without the priority tag.
  title: string
  done: number
  total: number
  // "P1" from "(Priority: P1)", when the heading has one.
  priority: string | null
  isMvp: boolean
  // The "**Checkpoint**: ..." line of the phase.
  checkpoint: string | null
  groups: Group[]
  // Label of an earlier blocking phase that still has tasks left.
  blockedBy: string | null
}

// What the spec's folder holds: where the feature is in the Spec Kit flow.
export type Stages = {
  hasSpec: boolean
  hasPlan: boolean
  hasTasks: boolean
  // "[NEEDS CLARIFICATION]" markers left in spec.md.
  clarifications: number
  checkDone: number
  checkTotal: number
}

export type Feature = {
  id: string
  done: number
  total: number
  phases: Phase[]
  // Label of the phase the next pending task sits in.
  phase: string | null
  next: Task | null
  // Ids of the other pending [P] tasks in that same phase.
  parallel: string[]
  tasks: Task[]
  stages: Stages
}

// Where the project says which spec is current, in the order Spec Kit reads it.
export type Hint = {
  source: 'env' | 'feature' | 'branch'
  value: string
}

// What the session started from, to tell what it got done.
export type Baseline = {
  at: number
  done: number
}

declare module 'claude-code' {
  interface PluginState {
    'spec-progress': {
      features: Shaped<Feature[]>
      // The spec whose tasks.md was edited last this session.
      activeId: string | null
      // The spec the person pinned with /tasks-progress <spec>.
      pinnedId: string | null
      hints: Shaped<Hint[]>
      isHidden: boolean
      // One line instead of the panel.
      isCompact: boolean
      // The pending task whose file the model edited last.
      workingId: string | null
      // Turns in a row that edited files without checking any task.
      drift: number
      baseline: Shaped<Baseline | null>
    }
  }
}
