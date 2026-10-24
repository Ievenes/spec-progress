import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Feature, Hint } from '../types'
import { flowCommand, parallelPrompt, phasePrompt, taskPrompt } from './actions'
import { STRINGS, fill, langOf } from './i18n'
import type { Lang } from './i18n'
import { etaText, matchTask, pace } from './live'
import { bar, brief, chips, clip, groupChips, parseTasks, width } from './parse'
import type { Chip } from './parse'
import { at, findRoot } from './root'
import { branchOf, featureDirOf, matchArg, pickActive } from './select'
import { countChecks, countClarifications, steps } from './stages'

const COMMAND = 'tasks-progress'
const PANE = 'spec-progress-tasks'
// An edit of a spec's own files: it makes that spec the active one.
const SPEC_PATH = /(?:^|[\\/])specs[\\/]([^\\/]+)[\\/](?:tasks|spec|plan)\.md$/
// Turns in a row that edit files without checking a task before the panel warns.
const DRIFT_TURNS = 3
// The palette of the other bands: violet for the work, green for done, clay for "here".
const ACCENT = '#8f8cf4'
const DONE = '#5fbf8f'
const CLAY = '#D97757'
const AMBER = '#E5A03C'
// The square around the cards is quiet; each card has a color of its own.
const OUTER_COLOR = '#585870'
const PHASES_COLOR = '#7f7fb8'
const OTHERS_COLOR = '#6b6b7b'

// Change the tag when a value's fields change: it declines what an earlier
// version stored, which outlives a reload.
const features = atom({ plugin: 'spec-progress', key: 'features' } as const, [], {
  shape: 'features-3',
})
const hints = atom({ plugin: 'spec-progress', key: 'hints' } as const, [], { shape: 'hints-1' })
const baseline = atom({ plugin: 'spec-progress', key: 'baseline' } as const, null, { shape: 'baseline-1' })
const activeId = atom({ plugin: 'spec-progress', key: 'activeId' } as const, null)
const pinnedId = atom({ plugin: 'spec-progress', key: 'pinnedId' } as const, null)
const isHidden = atom({ plugin: 'spec-progress', key: 'isHidden' } as const, false)
const isCompact = atom({ plugin: 'spec-progress', key: 'isCompact' } as const, false)
const workingId = atom({ plugin: 'spec-progress', key: 'workingId' } as const, null)
const drift = atom({ plugin: 'spec-progress', key: 'drift' } as const, 0)

// Module scope is fine for these: session.start sets them again on every
// (re)load, and what is lost is only a cache or a note for the turn.
let lang: Lang = 'en'
const tr = () => STRINGS[lang]
// Where the project is, relative to the session's folder: '.' or '../..'.
let root = '.'
// Whether the turn edited any file; the turn's end weighs it against the tasks checked.
let turnEdited = false
// Phases already complete as of the last read; undefined until the first
// read, so a reload or a session start never toasts what was already done.
let finished: Set<string> | undefined
// A spec's parsed files, kept while its files' modification times stay the same.
const cache = new Map<string, { sig: string; feature: Feature }>()

// `auto` follows Claude Code's own language setting, then the system locale.
async function detectLang($: EngineInterface, option: unknown): Promise<Lang> {
  if (typeof option === 'string' && option !== 'auto') return langOf(option)
  try {
    const settings = (await $.settings.read()) as Record<string, unknown>
    if (typeof settings.language === 'string' && settings.language.trim() !== '') return langOf(settings.language)
  } catch {
    // No settings: fall through to the locale.
  }
  const locale = (await $.env.get('LC_ALL')) || (await $.env.get('LC_MESSAGES')) || (await $.env.get('LANG'))

  return langOf(locale)
}

// Where the project says which spec is current, in the order Spec Kit itself
// reads it: SPECIFY_FEATURE, .specify/feature.json, then the git branch.
async function detectHints($: EngineInterface): Promise<Hint[]> {
  const found: Hint[] = []

  const env = (await $.env.get('SPECIFY_FEATURE').catch(() => undefined))?.trim()
  if (env) found.push({ source: 'env', value: env })

  const json = await textOf($, at(root, '.specify/feature.json'))
  const dir = json === null ? null : featureDirOf(json)
  if (dir !== null) found.push({ source: 'feature', value: dir })

  // A worktree's .git is a file, not a folder: it has no HEAD here, so no hint.
  const head = await textOf($, at(root, '.git/HEAD'))
  const branch = head === null ? null : branchOf(head)
  if (branch !== null) found.push({ source: 'branch', value: branch })

  return found
}

async function textOf($: EngineInterface, path: string): Promise<string | null> {
  const text = await $.fs.read(path).catch(() => null)

  return typeof text === 'string' ? text : null
}

async function current($: EngineInterface, list: Feature[]) {
  return pickActive(list, {
    pinned: await read($, pinnedId),
    hints: await read($, hints),
    edited: await read($, activeId),
  })
}

const doneOf = (list: Feature[]): number => list.reduce((sum, f) => sum + f.done, 0)

const detail = (list: Feature[], active: Feature | undefined): string =>
  list
    .map(f => {
      const lines = [`${f.id === active?.id ? '* ' : ''}${f.id}  ${bar(f.done, f.total)} ${f.done}/${f.total}`]
      for (const p of f.phases) {
        lines.push(`  ${p.done === p.total ? '[x]' : '[ ]'} ${p.label} ${p.done}/${p.total}`)
      }
      if (f.next) {
        const more = f.parallel.length > 0 ? ` (${tr().parallel}: ${f.parallel.join(', ')})` : ''
        lines.push(`  ${tr().current} ${f.next.id} ${f.next.text}${more}`)
      }

      return lines.join('\n')
    })
    .join('\n\n')

// Every spec folder of the project, read again only when one of its files changed.
async function load($: EngineInterface): Promise<Feature[]> {
  root = await findRoot(path => $.fs.exists(path))
  const base = at(root, 'specs')
  const entries = await $.fs.list(base).catch(() => [])
  const found: Feature[] = []
  const seen = new Set<string>()

  for (const entry of entries) {
    if (entry.kind !== 'dir') continue
    const dir = `${base}/${entry.name}`
    const files = new Map((await $.fs.list(dir).catch(() => [])).map(f => [f.name, f]))
    const hasSpec = files.has('spec.md')
    const hasPlan = files.has('plan.md')
    const hasTasks = files.has('tasks.md')
    if (!hasSpec && !hasPlan && !hasTasks) continue

    const checks = files.has('checklists') ? await $.fs.list(`${dir}/checklists`).catch(() => []) : []
    const sig = JSON.stringify([
      ['spec.md', 'plan.md', 'tasks.md'].map(name => files.get(name)?.mtimeMs ?? 0),
      checks.map(c => [c.name, c.mtimeMs]),
    ])
    seen.add(entry.name)

    const hit = cache.get(entry.name)
    if (hit?.sig === sig) {
      found.push(hit.feature)
      continue
    }

    const tasksMd = hasTasks ? await textOf($, `${dir}/tasks.md`) : null
    const specMd = hasSpec ? await textOf($, `${dir}/spec.md`) : null
    let checkDone = 0
    let checkTotal = 0
    for (const check of checks) {
      if (check.kind !== 'file' || !check.name.endsWith('.md')) continue
      const md = await textOf($, `${dir}/checklists/${check.name}`)
      if (md === null) continue
      const counted = countChecks(md)
      checkDone += counted.done
      checkTotal += counted.total
    }

    const feature: Feature = {
      id: entry.name,
      ...parseTasks(tasksMd ?? ''),
      stages: {
        hasSpec,
        hasPlan,
        hasTasks,
        clarifications: specMd === null ? 0 : countClarifications(specMd),
        checkDone,
        checkTotal,
      },
    }
    cache.set(entry.name, { sig, feature })
    found.push(feature)
  }

  for (const name of [...cache.keys()]) {
    if (!seen.has(name)) cache.delete(name)
  }

  return found.sort((a, b) => a.id.localeCompare(b.id))
}

// The status line says so once the turns pile up without a task checked.
async function syncStatus($: EngineInterface): Promise<void> {
  const turns = await read($, drift)
  $.ui.status(turns >= DRIFT_TURNS ? fill(tr().drift, { n: String(turns) }) : undefined)
}

async function refresh($: EngineInterface, edited?: string): Promise<void> {
  const before = doneOf(await read($, features))
  const list = await load($)
  await update($, features, () => list)
  const found = await detectHints($)
  await update($, hints, () => found)
  if (edited !== undefined) await update($, activeId, () => edited)

  const after = doneOf(list)
  if (after > before) await update($, drift, () => 0)

  // The task being worked on is no longer "being worked on" once it is checked.
  const pending = new Set(list.flatMap(f => f.tasks.filter(task => !task.isDone).map(task => task.id)))
  const working = await read($, workingId)
  if (working !== null && !pending.has(working)) await update($, workingId, () => null)

  if ((await read($, baseline)) === null) {
    const startedAt = await $.clock.now()
    await update($, baseline, () => ({ at: startedAt, done: after }))
  }

  const now = new Set<string>()
  for (const f of list) {
    for (const p of f.phases) {
      if (p.done === p.total) now.add(`${f.id}/${p.label}`)
    }
  }
  if (finished !== undefined) {
    for (const key of now) {
      if (!finished.has(key)) $.ui.toast(`${tr().phaseDone}: ${key}`)
    }
  }
  finished = now

  await syncStatus($)
}

// Puts `text` in the prompt box for the person to read and send: after what is
// already typed, never over it. Nothing is sent.
async function fillPrompt($: EngineInterface, text: string | null): Promise<void> {
  if (text === null) return
  const box = await $.prompt.read().catch(() => ({ text: '', cursor: 0 }))
  await $.prompt.fill(box.text.trim() === '' ? { text } : { text: `\n${text}`, mode: 'append' })
  $.ui.toast(tr().filled)
}

export const register: Register = (on, options) => {
  on('session.start', async ($, e, next) => {
    lang = await detectLang($, options.language)
    // A refused name must not stop the panel from loading its first read.
    await $.command
      .register({
        name: COMMAND,
        description: tr().command,
        argumentHint: '[spec | auto | next | phase | list]',
      })
      .catch(() => undefined)
    await refresh($)

    return next(e)
  })

  // No argument: the details, and the panel back after the ✕ hid it.
  // A spec (its id, or the start of it: "002"): pins the panel to it; "auto" unpins.
  // "next" and "phase <label>" put the prompt for it in the box; "list" opens the task list.
  on('command.run', { command: COMMAND }, async ($, e) => {
    const t = tr()
    const [word = '', ...words] = e.args.trim().split(/\s+/)
    const arg = words.join(' ')
    await update($, isHidden, () => false)
    await refresh($)
    const list = await read($, features)
    if (list.length === 0) return { text: t.noTasks }

    let note = ''
    if (word === 'auto' || word === 'reset') {
      await update($, pinnedId, () => null)
      note = t.pinCleared
    } else if (word === 'list') {
      await $.ui.open({ id: PANE, title: t.paneTitle })
    } else if (word === 'next' || word === 'phase') {
      const f = (await current($, list))?.feature
      const phase = f?.phases.find(p => p.label.toLowerCase() === arg.toLowerCase())
      const starts = f?.phases.find(p => arg !== '' && p.label.toLowerCase().startsWith(arg.toLowerCase()))
      const prompt =
        f === undefined
          ? null
          : word === 'next'
            ? (taskPrompt(t, f) ?? flowCommand(f))
            : phasePrompt(t, f, arg === '' ? f.phase : (phase ?? starts)?.label)
      if (word === 'phase' && arg !== '' && !phase && !starts && f) {
        const open = f.phases.filter(p => p.done < p.total).map(p => p.label)

        return { text: fill(t.noPhase, { query: arg, list: open.join(', ') }) }
      }
      if (prompt === null) return { text: t.nothingToRun }
      await fillPrompt($, prompt)
      note = t.filled
    } else if (word !== '') {
      const hit = matchArg(list, e.args)
      if (!hit) {
        return { text: fill(t.noMatch, { query: e.args.trim(), list: list.map(f => f.id).join(', ') }) }
      }
      await update($, pinnedId, () => hit.id)
      note = fill(t.pinSet, { id: hit.id })
    }

    const picked = await current($, list)
    const how = picked ? fill(t.via, { how: t.sources[picked.source] }) : ''
    const head = [note, how].filter(line => line !== '')

    return { text: [...head, '', detail(list, picked?.feature)].join('\n') }
  })

  on('tool.call', { tool: ['Edit', 'Write'] }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny !== undefined) return ran

    const hit = SPEC_PATH.exec(e.file_path)
    if (hit) {
      await refresh($, hit[1])

      return ran
    }

    // Code was edited: note it, and say which pending task names that file.
    turnEdited = true
    const picked = await current($, await read($, features))
    const task = picked ? matchTask(picked.feature.tasks, e.file_path) : undefined
    if (task) await update($, workingId, () => task.id)

    return ran
  })

  // Safety net for edits that did not come through Edit or Write (Bash, sed),
  // where a branch switch made through Bash is noticed, and where a turn that
  // edited files without checking any task is counted.
  on('turn.complete', async ($, e, next) => {
    const before = doneOf(await read($, features))
    await refresh($)
    const after = doneOf(await read($, features))
    if (turnEdited && after <= before) {
      const picked = await current($, await read($, features))
      if (picked && picked.feature.next) await update($, drift, n => n + 1)
      await syncStatus($)
    }
    turnEdited = false

    return next(e)
  })

  // Optional: tell the model which spec is active, so it follows tasks.md in order.
  // The text holds the spec and the phase only: it changes as seldom as it can,
  // because a changed section rewrites the prompt cache.
  on('prompt.compose', async ($, e, next) => {
    const result = await next(e)
    if (options.modelContext !== 'on') return result

    const picked = await current($, await read($, features))
    if (!picked) return result
    const f = picked.feature
    const text = [
      `Spec Kit context (from the spec-progress mod): the active spec is specs/${f.id}/.`,
      f.phase ? `Its current phase is ${f.phase}.` : '',
      'Work through tasks.md in order, respect each phase checkpoint, and mark a task [X] in tasks.md as soon as it is done.',
    ]
      .filter(line => line !== '')
      .join(' ')

    return { sections: [...result.sections, { id: 'spec-progress:context', text, scope: 'session' as const }] }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    // The band is one instance: keep what the plugins beneath draw (the token
    // band) and stack ours with it, instead of replacing it.
    const below = await next(e)
    const list = await read($, features)
    const isQuiet = e.props.hasSurvey || list.length === 0 || (await read($, isHidden))
    if (isQuiet) return below

    const picked = await current($, list)
    if (!picked) return below
    const f = picked.feature

    const { Box, Button, Text } = $.ui.resolve(e)
    const t = tr()
    const columns = e.props.bodyColumns
    const others = list.filter(x => x.id !== f.id)

    const hasTasks = f.stages.hasTasks && f.total > 0
    const isDone = f.total > 0 && f.done === f.total
    const tone = isDone ? DONE : ACCENT
    const percent = f.total === 0 ? 0 : Math.round((f.done / f.total) * 100)
    const count = `${f.done}/${f.total}`
    const tag = picked.source === 'pinned' ? t.pinned : ''
    const phase = f.phases.find(p => p.label === f.phase)
    const parallel = f.parallel.length
    const flow = flowCommand(f)
    const stepList = steps(f.stages, f.done, f.total)
    const currentStep = stepList.find(s => s.state === 'current')
    const turns = await read($, drift)
    const isDrifting = hasTasks && !isDone && turns >= DRIFT_TURNS
    const workingTaskId = await read($, workingId)
    const working = f.tasks.find(task => task.id === workingTaskId && !task.isDone)
    const isNextWorking = working !== undefined && working.id === f.next?.id

    const toggle = (
      <Button key="compact" label={(await read($, isCompact)) ? '▾' : '▴'} plain onPress={() => update($, isCompact, v => !v)} />
    )
    const hide = <Button key="hide" label="✕" plain onPress={() => update($, isHidden, () => true)} />

    if (await read($, isCompact)) {
      // One line: spec, bar, where it is, what is next.
      const title = clip(f.id, Math.max(10, Math.min(30, Math.floor(columns / 4))))
      const mid = hasTasks
        ? phase
          ? `${phase.label} ${phase.done}/${phase.total}`
          : count
        : currentStep
          ? t.stepNames[currentStep.key]
          : ''
      const barWidth = 10
      const filled = f.total === 0 ? 0 : Math.round((f.done / f.total) * barWidth)
      const used = 2 + width(title) + (hasTasks ? barWidth + width(count) + 4 : 0) + width(mid) + 14
      const room = Math.max(0, columns - used)
      const nextText = hasTasks ? (f.next ? `${f.next.id} ${brief(f.next.text, Math.max(8, room - 4))}` : t.allDone) : (flow ?? '')

      return (
        <Box flexDirection="column">
          <Box flexDirection="row" gap={2}>
            <Text>
              <Text color={tone}>◆ </Text>
              <Text bold>{title}</Text>
            </Text>
            {hasTasks && (
              <Text>
                <Text color={tone}>{'█'.repeat(filled)}</Text>
                <Text dimColor>{'░'.repeat(barWidth - filled)}</Text>
              </Text>
            )}
            {hasTasks && <Text bold>{count}</Text>}
            <Text color={CLAY}>{mid}</Text>
            {room >= 10 && nextText !== '' && <Text wrap="truncate-end">{`${isNextWorking ? '▶' : '▸'} ${nextText}`}</Text>}
            {isDrifting && <Text color={AMBER}>⚠</Text>}
            {toggle}
            {hide}
          </Box>
          {below}
        </Box>
      )
    }

    // One square holds a card for each part. From 100 columns inside the square the
    // cards sit side by side (spec and phases on the left, the task on the right);
    // narrower, they stack. Every card keeps its name beside its rows.
    const inner = columns - 4
    const isWide = inner >= 100
    const leftW = isWide ? Math.floor((inner - 1) * 0.52) : inner
    const rightW = isWide ? inner - 1 - leftW : inner
    const hasGroups = hasTasks && phase !== undefined && phase.groups.length > 1
    const leftLabel = Math.max(...[t.spec, t.steps, ...(hasTasks ? [t.phases] : []), ...(hasGroups ? [t.groups] : [])].map(width)) + 1
    const rightLabel = width(hasTasks ? t.current : t.next) + 1
    // Stacked cards share one label width so their rows line up.
    const labelL = isWide ? leftLabel : Math.max(leftLabel, rightLabel)
    const labelR = isWide ? rightLabel : labelL
    const labelO = isWide ? width(t.others) + 1 : labelL
    const roomL = Math.max(16, leftW - 4 - labelL - 1)
    const roomR = Math.max(16, rightW - 4 - labelR - 1)
    const roomO = Math.max(16, inner - 4 - labelO - 1)

    const title = clip(f.id, Math.max(12, Math.min(36, Math.floor(roomL / 2.5))))
    // The rest of the row: "◆ ", the gaps, the count, the percent, the tag and the two buttons.
    const barWidth = Math.max(6, Math.min(24, roomL - width(title) - count.length - width(tag) - 20))
    const filled = f.total === 0 ? 0 : Math.round((f.done / f.total) * barWidth)

    const colorOf = { done: DONE, current: CLAY, todo: undefined, blocked: AMBER, more: undefined } as const
    const chipRow = (key: string, list: Chip[]) => (
      <Box flexDirection="row" gap={2}>
        {list.map(c => (
          <Text
            key={`${key}:${c.text}`}
            color={colorOf[c.kind]}
            dimColor={c.kind === 'todo' || c.kind === 'more'}
            bold={c.kind === 'current'}
          >
            {c.text}
          </Text>
        ))}
      </Box>
    )

    // The flow's steps; narrow rooms keep the finished count and the step in progress.
    const stepChips: Chip[] = stepList.map(s => ({
      text: `${s.state === 'done' ? '✓' : s.state === 'current' ? '●' : '○'} ${t.stepNames[s.key]}`,
      kind: s.state,
    }))
    const stepWidth = stepChips.reduce((sum, c) => sum + width(c.text) + 2, 0)
    const shownSteps: Chip[] =
      stepWidth <= roomL - 20
        ? stepChips
        : [
            ...(stepList.filter(s => s.state === 'done').length > 0
              ? [{ text: `✓ ${stepList.filter(s => s.state === 'done').length}`, kind: 'done' as const }]
              : []),
            ...stepChips.filter(c => c.kind === 'current'),
          ]

    const { checkDone, checkTotal, clarifications } = f.stages
    const pending = f.phases.filter(p => p.done < p.total)
    const base = await read($, baseline)
    const rate = base
      ? pace(doneOf(list) - base.done, (await $.clock.now()) - base.at, f.total - f.done)
      : null
    const rateText = rate
      ? [
          fill(t.perHour, { n: String(rate.perHour) }),
          rate.etaMinutes === null ? '' : fill(t.eta, { t: etaText(rate.etaMinutes) }),
        ]
          .filter(part => part !== '')
          .join(' · ')
      : ''

    const nextPrompt = taskPrompt(t, f)
    const phasePrompted = phasePrompt(t, f)
    const parallelPrompted = parallelPrompt(t, f)

    const rest = others
      .map(x => {
        if (x.total === 0) {
          const step = steps(x.stages, x.done, x.total).find(s => s.state === 'current')

          return `${x.id} ${step ? t.stepNames[step.key] : ''}`.trim()
        }

        return x.done === x.total ? `${x.id} ✓` : `${x.id} ${x.done}/${x.total}`
      })
      .join('  ·  ')

    // A row of a card: its name in a dim column, then the content.
    const row = (key: string, label: string, labelWidth: number, body: unknown) => (
      <Box key={`row:${key}`} flexDirection="row" gap={1}>
        <Box width={labelWidth} flexShrink={0}>
          <Text dimColor>{label}</Text>
        </Box>
        <Box flexDirection="column" flexGrow={1}>
          {body}
        </Box>
      </Box>
    )

    // A card: its own border in its own color, around the rows of one part.
    const card = (key: string, color: string, w: number, rows: unknown) => (
      <Box key={`card:${key}`} flexDirection="column" borderStyle="round" borderColor={color} paddingX={1} width={w} flexShrink={0}>
        {rows}
      </Box>
    )

    // The task card: the id, the description shortened to its first clause (two lines at
    // most) and wrapped, then what surrounds it.
    // Its buttons are drawn below the card, not in it.
    const rule = '─'.repeat(Math.max(4, roomR))
    const currentBody = f.next ? (
      <Box flexDirection="column">
        <Text>
          <Text color={isNextWorking ? AMBER : CLAY}>{isNextWorking ? '▶ ' : '▸ '}</Text>
          <Text bold>{f.next.id}</Text>
          {isNextWorking && <Text dimColor>{`  ${t.working}`}</Text>}
        </Text>
        <Text wrap="wrap">{brief(f.next.text, Math.max(40, roomR * 2))}</Text>
        {working && !isNextWorking && (
          <Text wrap="wrap">
            <Text color={AMBER}>{'▶ '}</Text>
            <Text bold>{working.id}</Text>
            <Text dimColor>{`  ${t.working}  `}</Text>
            <Text>{brief(working.text, Math.max(40, roomR * 2))}</Text>
          </Text>
        )}
        <Text dimColor>{rule}</Text>
        {phase && (
          <Text dimColor wrap="wrap">
            {`${phase.label} · ${phase.title}`}
            {phase.blockedBy !== null && <Text color={AMBER}>{`  ⊘ ${fill(t.waiting, { phase: phase.blockedBy })}`}</Text>}
          </Text>
        )}
        {parallel > 0 && (
          <Text dimColor wrap="wrap">{`∥ ${parallel} ${t.parallel}: ${f.parallel.join(', ')}`}</Text>
        )}
        {rateText !== '' && <Text dimColor wrap="wrap">{rateText}</Text>}
        {phase?.checkpoint && (
          <Text dimColor wrap="wrap">{`⚑ ${t.checkpoint}: ${phase.checkpoint}`}</Text>
        )}
        {isDrifting && <Text color={AMBER} wrap="wrap">{fill(t.drift, { n: String(turns) })}</Text>}
      </Box>
    ) : (
      <Text color={DONE}>{`✓ ${t.allDone}`}</Text>
    )

    // The buttons, packed into as many rows as the width asks for. A button is
    // drawn as "[ label ]": its label and four columns.
    type Action = { key: string; label: string; onPress: () => unknown }
    const actions: Action[] = [
      ...(hasTasks && nextPrompt !== null
        ? [{ key: 'next', label: t.btnNext, onPress: () => fillPrompt($, nextPrompt) }]
        : []),
      ...(hasTasks && phasePrompted !== null
        ? [{ key: 'phase', label: `${t.btnPhase} ${f.phase}`, onPress: () => fillPrompt($, phasePrompted) }]
        : []),
      ...(hasTasks && parallelPrompted !== null
        ? [{ key: 'parallel', label: `${t.btnParallel} ∥${parallel + 1}`, onPress: () => fillPrompt($, parallelPrompted) }]
        : []),
      ...(!hasTasks && flow ? [{ key: 'flow', label: flow, onPress: () => fillPrompt($, flow) }] : []),
      ...(hasTasks ? [{ key: 'list', label: t.btnList, onPress: () => $.ui.open({ id: PANE, title: t.paneTitle }) }] : []),
    ]
    const actionRows: Action[][] = []
    let usedWidth = 0
    for (const action of actions) {
      const w = width(action.label) + 4
      const last = actionRows[actionRows.length - 1]
      if (last === undefined || usedWidth + w + 1 > rightW - 2) {
        actionRows.push([action])
        usedWidth = w
      } else {
        last.push(action)
        usedWidth += w + 1
      }
    }
    const actionsBox =
      actionRows.length === 0 ? null : (
        <Box flexDirection="column" paddingX={1}>
          {actionRows.map((line, i) => (
            <Box key={`actions:${i}`} flexDirection="row" gap={1}>
              {line.map(a => (
                <Button key={`act:${a.key}`} label={a.label} onPress={a.onPress} />
              ))}
            </Box>
          ))}
        </Box>
      )

    const specCard = card(
      'spec',
      tone,
      leftW,
      [
        row(
          'spec',
          t.spec,
          labelL,
          <Box flexDirection="row" gap={2}>
            <Text>
              <Text color={tone}>◆ </Text>
              <Text bold>{title}</Text>
            </Text>
            {hasTasks && (
              <Text>
                <Text color={tone}>{'█'.repeat(filled)}</Text>
                <Text dimColor>{'░'.repeat(barWidth - filled)}</Text>
              </Text>
            )}
            {hasTasks && <Text bold>{count}</Text>}
            {hasTasks && <Text dimColor>{`${percent}%`}</Text>}
            {tag !== '' && <Text color={CLAY}>{tag}</Text>}
            {toggle}
            {hide}
          </Box>,
        ),
        row(
          'steps',
          t.steps,
          labelL,
          <Box flexDirection="row" gap={2}>
            {chipRow('step', shownSteps)}
            {checkTotal > 0 && <Text dimColor>{`${t.checklists} ${checkDone}/${checkTotal}`}</Text>}
            {clarifications > 0 && <Text color={AMBER}>{`? ${clarifications}`}</Text>}
          </Box>,
        ),
      ],
    )

    const phasesCard = hasTasks
      ? card(
          'phases',
          PHASES_COLOR,
          leftW,
          [
            row('phases', t.phases, labelL, chipRow('phase', chips(f.phases, f.phase, roomL))),
            hasGroups && phase
              ? row('groups', t.groups, labelL, chipRow('group', groupChips(phase.groups, f.next?.group ?? null)))
              : null,
          ],
        )
      : null

    const nextStep = stepList.find(s => s.state === 'current')
    const taskCard = card(
      'task',
      CLAY,
      rightW,
      hasTasks
        ? row('current', t.current, labelR, currentBody)
        : row(
            'next',
            t.next,
            labelR,
            flow ? (
              <Text>
                <Text color={CLAY}>▸ </Text>
                <Text bold>{nextStep ? t.stepNames[nextStep.key] : flow}</Text>
              </Text>
            ) : (
              <Text dimColor>{pending.length === 0 ? t.allDone : ''}</Text>
            ),
          ),
    )

    // The card with its buttons right under it, outside its border.
    const taskColumn = (
      <Box flexDirection="column" width={rightW} flexShrink={0}>
        {taskCard}
        {actionsBox}
      </Box>
    )

    const othersCard =
      rest !== '' ? card('others', OTHERS_COLOR, inner, row('others', t.others, labelO, <Text dimColor>{clip(rest, roomO)}</Text>)) : null

    return (
      <Box flexDirection="column">
        <Box flexDirection="column" borderStyle="round" borderColor={OUTER_COLOR} paddingX={1}>
          {isWide ? (
            <Box flexDirection="row" gap={1}>
              <Box flexDirection="column">
                {specCard}
                {phasesCard}
              </Box>
              {taskColumn}
            </Box>
          ) : (
            <Box flexDirection="column">
              {specCard}
              {phasesCard}
              {taskColumn}
            </Box>
          )}
          {othersCard}
        </Box>
        {below}
      </Box>
    )
  })

  // The full list: every phase on a line, the current one open with its tasks.
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const t = tr()
    const picked = await current($, await read($, features))
    if (!picked) return <Text dimColor>{t.noTasks}</Text>

    const f = picked.feature
    const columns = e.viewport?.columns ?? 80
    const workingTaskId = await read($, workingId)
    const colorOf = { done: DONE, current: CLAY, todo: undefined, blocked: AMBER, more: undefined } as const
    const icon = { done: '✓', current: '●', todo: '○', blocked: '⊘' } as const

    return (
      <Box flexDirection="column">
        <Text>
          <Text color={ACCENT}>◆ </Text>
          <Text bold>{f.id}</Text>
          <Text dimColor>{`  ${f.done}/${f.total}`}</Text>
        </Text>
        {f.phases.map(p => {
          const kind = p.done === p.total ? 'done' : p.label === f.phase ? 'current' : p.blockedBy !== null ? 'blocked' : 'todo'
          const header = `${icon[kind]} ${p.label} · ${clip(p.title, Math.max(12, columns - 24))}  ${p.done}/${p.total}`
          const tasks = kind === 'current' ? f.tasks.filter(task => task.phase === p.label) : []

          return (
            <Box key={`phase:${p.label}`} flexDirection="column" marginTop={1}>
              <Text color={colorOf[kind]} bold={kind === 'current'} dimColor={kind === 'todo'} wrap="truncate-end">
                {header}
              </Text>
              {kind === 'current' && p.checkpoint && (
                <Text dimColor wrap="truncate-end">{`  ⚑ ${clip(p.checkpoint, Math.max(12, columns - 6))}`}</Text>
              )}
              {tasks.map((task, i) => {
                const isWorking = task.id === workingTaskId && !task.isDone
                const group = task.group !== null && task.group !== tasks[i - 1]?.group ? task.group : null

                return (
                  <Box key={`task:${task.id}`} flexDirection="column">
                    {group !== null && <Text dimColor>{`  ${group}`}</Text>}
                    <Text dimColor={task.isDone} color={isWorking ? AMBER : undefined} wrap="truncate-end">
                      {`  ${isWorking ? '▶' : task.isDone ? '✓' : '·'} ${task.id}  ${brief(task.text, Math.max(16, columns - 14))}`}
                    </Text>
                  </Box>
                )
              })}
            </Box>
          )
        })}
      </Box>
    )
  })
}
