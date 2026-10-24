import type { Feature, Group, Phase, Task } from '../types'

export type Parsed = Omit<Feature, 'id' | 'stages'>

const HEADING = /^##\s+(.+?)\s*$/
const SUBHEADING = /^###\s+(.+?)\s*$/
const FENCE = /^\s*(?:```|~~~)/
const TASK = /^\s*-\s\[([ xX])\]\s+(T\d+)\s*(\[P\])?\s*(?:\[US\d+\])?\s*(.*)$/

// A spec may be written in any language: the heading words below are the ones
// Spec Kit templates get translated to; anything else falls to the catch-all.
const PHASE = /^(?:Phase|Fase|Fasi|Étape|Etapa|Stufe|阶段|階段|フェーズ|단계)\s*\d+\s*[:：.\-–—]?\s*(.+)$/iu
const STORY =
  /^(?:User Story|História de Usuário|Historia de Usuario|Récit utilisateur|Histoire utilisateur|Benutzergeschichte|Storia utente|用户故事|ユーザーストーリー)\s*(\d+)\s*[:：\-–—]?\s*(.*)$/iu
const PRIORITY_WORDS = 'Priority|Prioridade|Prioridad|Priorité|Priorität|Priorità|优先级|優先度'
const PRIORITY = new RegExp(`\\s*[(（](?:${PRIORITY_WORDS})[^)）]*[)）]`, 'giu')
const PRIORITY_TAG = new RegExp(`[(（](?:${PRIORITY_WORDS})\\s*[:：]\\s*(P\\d)`, 'iu')
const CHECKPOINT =
  /^\s*\*\*(?:Checkpoint|Ponto de controle|Ponto de verificação|Punto de control|Point de contrôle|Kontrollpunkt|Punto di controllo)\*\*\s*[:：]\s*(.+?)\s*$/iu
const BLOCKING = /Foundational|bloqueant|blocking|fundaç|fundament|pré-?requis|prerequis|vorausset|grundlag/iu
const PICTOGRAPH = /\p{Extended_Pictographic}️?/gu
const MVP = /\bMVP\b|🎯/u

// "Phase 3: User Story 1 - Title (Priority: P1)" -> "US1"; "Phase 1: Setup (Shared)" -> "Setup"
const labelOf = (heading: string): string => {
  const body = PHASE.exec(heading)?.[1] ?? heading
  const story = STORY.exec(body)
  if (story) return `US${story[1]}`

  return body.replace(/\s*[(（].*$/u, '').replace(/\s+[-–—]\s+.*$/u, '').trim()
}

const titleOf = (heading: string): string => {
  const body = PHASE.exec(heading)?.[1] ?? heading
  const story = STORY.exec(body)?.[2]
  const text = story !== undefined && story !== '' ? story : body

  return text.replace(PRIORITY, '').replace(PICTOGRAPH, '').replace(/\s+/g, ' ').trim()
}

// "2A. Configuração local (primeiro…)" -> "2A"; "Tests for User Story 1" -> as is, cut short.
const groupOf = (heading: string): string => {
  const code = /^(\d+[A-Za-z]?)[.\s:]/.exec(heading)?.[1]
  if (code) return code

  return clip(heading.replace(/\s*[(（].*$/u, '').trim(), 22)
}

// Paths the text names between code ticks: "`API/config/bootstrap.php`" -> "API/config/bootstrap.php".
const filesOf = (text: string): string[] => {
  const found: string[] = []
  for (const match of text.matchAll(/`([^`\s]+)`/g)) {
    const token = (match[1] ?? '').replace(/\\/g, '/').replace(/^\.\//, '')
    if (/[{}*<>|$=]|:\/\//.test(token) || token.startsWith('-')) continue
    const isPath = token.includes('/') ? /\.[A-Za-z0-9]+|\/$/.test(token) : /\.[A-Za-z0-9]{1,6}$/.test(token)
    if (isPath && !found.includes(token)) found.push(token)
  }

  return found.slice(0, 6)
}

export const parseTasks = (md: string): Parsed => {
  const phases: Phase[] = []
  const tasks: Task[] = []
  let current: Phase | null = null
  let group: string | null = null
  let isFenced = false

  for (const line of md.split(/\r?\n/)) {
    // A fenced block is an example, not part of the plan.
    if (FENCE.test(line)) {
      isFenced = !isFenced
      continue
    }
    if (isFenced) continue

    const heading = HEADING.exec(line)
    if (heading) {
      const text = heading[1] ?? ''
      current = {
        label: labelOf(text),
        title: titleOf(text),
        done: 0,
        total: 0,
        priority: PRIORITY_TAG.exec(text)?.[1]?.toUpperCase() ?? null,
        isMvp: MVP.test(text),
        checkpoint: null,
        groups: [],
        blockedBy: null,
      }
      group = null
      continue
    }

    const sub = SUBHEADING.exec(line)
    if (sub) {
      group = groupOf(sub[1] ?? '')
      continue
    }

    const checkpoint = CHECKPOINT.exec(line)
    if (checkpoint && current) {
      current.checkpoint = (checkpoint[1] ?? '').replace(/`/g, '')
      continue
    }

    const match = TASK.exec(line)
    if (!match) continue

    // A task before any "##" heading still counts, under a catch-all phase.
    if (!current) {
      current = {
        label: 'Tasks',
        title: 'Tasks',
        done: 0,
        total: 0,
        priority: null,
        isMvp: false,
        checkpoint: null,
        groups: [],
        blockedBy: null,
      }
    }
    if (!phases.includes(current)) phases.push(current)

    const isDone = match[1] !== ' '
    current.total += 1
    if (isDone) current.done += 1

    if (group !== null) {
      let entry: Group | undefined = current.groups.find(g => g.label === group)
      if (!entry) {
        entry = { label: group, done: 0, total: 0 }
        current.groups.push(entry)
      }
      entry.total += 1
      if (isDone) entry.done += 1
    }

    const text = (match[4] ?? '').trim()
    tasks.push({
      id: match[2] ?? '',
      text,
      isParallel: match[3] !== undefined,
      isDone,
      phase: current.label,
      group,
      files: filesOf(text),
    })
  }

  // A foundational phase with tasks left holds back the user-story phases after it.
  phases.forEach((p, i) => {
    if (p.done === p.total || !BLOCKING.test(`${p.label} ${p.title}`)) return
    for (const later of phases.slice(i + 1)) {
      if (/^US\d+$/.test(later.label)) later.blockedBy = p.label
    }
  })

  const first = tasks.find(t => !t.isDone)
  const parallel = first
    ? tasks.filter(t => !t.isDone && t.phase === first.phase && t.isParallel && t.id !== first.id).map(t => t.id)
    : []

  return {
    phases,
    done: phases.reduce((sum, p) => sum + p.done, 0),
    total: phases.reduce((sum, p) => sum + p.total, 0),
    phase: first?.phase ?? null,
    next: first ?? null,
    parallel,
    tasks,
  }
}

export const bar = (done: number, total: number, width = 10): string => {
  const filled = total === 0 ? 0 : Math.round((done / total) * width)

  return '▓'.repeat(filled) + '░'.repeat(width - filled)
}

// Columns a character takes in a terminal: CJK and emoji take two, combining marks none.
const cells = (ch: string): number => {
  const cp = ch.codePointAt(0) ?? 0
  if (cp >= 0x300 && cp <= 0x36f) return 0

  return (cp >= 0x1100 && cp <= 0x115f) ||
    (cp >= 0x2e80 && cp <= 0xa4cf) ||
    (cp >= 0xac00 && cp <= 0xd7a3) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xfe30 && cp <= 0xfe6f) ||
    (cp >= 0xff00 && cp <= 0xff60) ||
    (cp >= 0xffe0 && cp <= 0xffe6) ||
    (cp >= 0x1f300 && cp <= 0x1faff) ||
    (cp >= 0x20000 && cp <= 0x3fffd)
    ? 2
    : 1
}

export const width = (text: string): number => [...text].reduce((sum, ch) => sum + cells(ch), 0)

// Cut to `max` columns, never inside a character, with an ellipsis.
export function clip(text: string, max: number): string {
  if (width(text) <= max) return text

  let out = ''
  let used = 0
  for (const ch of text) {
    const w = cells(ch)
    if (used + w > Math.max(1, max - 1)) break
    out += ch
    used += w
  }

  return `${out.trimEnd()}…`
}

// The first clause of a task description, without code ticks, cut to `max`:
// "Criar `a.sql` com: x, y, z" -> "Criar a.sql com".
export const brief = (text: string, max = 56): string => {
  const plain = text.replace(/`/g, '').trim()
  const first = plain.split(/:\s|[：。；]|\s[—–]\s|\s[(（]|;\s|\.\s/u)[0]?.trim() ?? ''

  return clip(first === '' ? plain : first, max)
}

export type Chip = { text: string; kind: 'done' | 'current' | 'todo' | 'blocked' | 'more' }

// One chip per phase: "✓ Setup", "● US1 3/10" for the phase in progress, "○ US2",
// "⊘ US3" for one held back by an earlier phase. A priority and the MVP star
// ride after the name ("○ US1 P1 ★"). When they do not fit `columns`,
// finished phases fold into "✓ N" and the tail the row cannot hold into "+N".
export const chips = (phases: Phase[], current: string | null, columns: number): Chip[] => {
  const tag = (p: Phase): string => [p.priority, p.isMvp ? '★' : null].filter(Boolean).join(' ')
  const one = (p: Phase): Chip => {
    const extra = tag(p) === '' ? '' : ` ${tag(p)}`
    if (p.done === p.total) return { text: `✓ ${p.label}`, kind: 'done' }
    if (p.label === current) return { text: `● ${p.label} ${p.done}/${p.total}${extra}`, kind: 'current' }
    if (p.blockedBy !== null) return { text: `⊘ ${p.label}${extra}`, kind: 'blocked' }

    return { text: `○ ${p.label}${extra}`, kind: 'todo' }
  }
  const span = (list: Chip[]): number => list.reduce((sum, c) => sum + width(c.text) + 2, 0)

  let list = phases.map(one)
  if (span(list) <= columns) return list

  const finished = list.filter(c => c.kind === 'done').length
  if (finished > 1) {
    list = [{ text: `✓ ${finished}`, kind: 'done' }, ...list.filter(c => c.kind !== 'done')]
  }
  const kept = list.length
  while (list.length > 2 && span(list) + 5 > columns) list = list.slice(0, -1)

  return list.length < kept ? [...list, { text: `+${kept - list.length}`, kind: 'more' }] : list
}

// The "###" groups of a phase as chips: "✓ 2A", "● 2D 3/12" for the one the next task sits in, "○ 2E".
export const groupChips = (groups: Group[], current: string | null): Chip[] =>
  groups.map(g => {
    if (g.done === g.total) return { text: `✓ ${g.label}`, kind: 'done' }
    if (g.label === current) return { text: `● ${g.label} ${g.done}/${g.total}`, kind: 'current' }

    return { text: `○ ${g.label}`, kind: 'todo' }
  })
