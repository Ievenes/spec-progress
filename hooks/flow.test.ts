import { expect, test } from 'claude-code/testing'

import type { Feature, Stages, Task } from '../types'
import { flowCommand, parallelPrompt, phasePrompt, taskPrompt } from './actions'
import { STRINGS } from './i18n'
import { etaText, matchTask, pace } from './live'
import { parseTasks } from './parse'
import { at, findRoot } from './root'
import { countChecks, countClarifications, nextCommand, steps } from './stages'

const stages = (extra: Partial<Stages> = {}): Stages => ({
  hasSpec: true,
  hasPlan: true,
  hasTasks: true,
  clarifications: 0,
  checkDone: 0,
  checkTotal: 0,
  ...extra,
})

const task = (id: string, files: string[], isDone = false): Task => ({
  id,
  text: id,
  isParallel: false,
  isDone,
  phase: 'US1',
  group: null,
  files,
})

const MD = [
  '## Phase 2: Foundational',
  '- [ ] T001 [P] Create `API/config/bootstrap.php`: details here',
  '- [ ] T002 [P] Other',
  '## Phase 3: User Story 1 - Boot (Priority: P1)',
  '- [ ] T003 [US1] Go',
].join('\n')

const feature = (extra: Partial<Feature> = {}): Feature => ({
  id: '001-demo',
  ...parseTasks(MD),
  stages: stages(),
  ...extra,
})

test('the flow steps follow the files of the spec folder', () => {
  const none = stages({ hasSpec: false, hasPlan: false, hasTasks: false })

  expect(steps(none, 0, 0).map(s => s.state)).toEqual(['current', 'todo', 'todo', 'todo', 'todo'])
  expect(nextCommand(none, 0, 0)).toBe('/speckit-specify')

  const planned = stages({ hasTasks: false })
  expect(steps(planned, 0, 0).map(s => s.state)).toEqual(['done', 'done', 'done', 'current', 'todo'])
  expect(nextCommand(planned, 0, 0)).toBe('/speckit-tasks')

  const unclear = stages({ hasPlan: false, hasTasks: false, clarifications: 2 })
  expect(steps(unclear, 0, 0).map(s => s.state)).toEqual(['done', 'current', 'todo', 'todo', 'todo'])
  expect(nextCommand(unclear, 0, 0)).toBe('/speckit-clarify')

  expect(nextCommand(stages(), 3, 10)).toBe('/speckit-implement')
  expect(nextCommand(stages(), 10, 10)).toBe(null)
  expect(steps(stages(), 10, 10).every(s => s.state === 'done')).toBe(true)
})

test('checkboxes and clarification markers are counted, fenced examples left out', () => {
  const md = ['- [x] a', '- [ ] b', '```', '- [ ] example', '```', '  - [X] c'].join('\n')

  expect(countChecks(md)).toEqual({ done: 2, total: 3 })
  expect(countClarifications('a [NEEDS CLARIFICATION: x] b [needs clarification: y]')).toBe(2)
  expect(countClarifications('clean')).toBe(0)
})

test('the project root is found from a sub-folder', async () => {
  const has = (...paths: string[]) => async (p: string) => paths.includes(p)

  expect(await findRoot(has('./.specify'))).toBe('.')
  expect(await findRoot(has('../../.specify'))).toBe('../..')
  expect(await findRoot(has('../specs'))).toBe('..')
  expect(await findRoot(has())).toBe('.')
  expect(at('.', 'specs')).toBe('specs')
  expect(at('../..', 'specs')).toBe('../../specs')
})

test('an edited file names the pending task that cites it, the longest path first', () => {
  const tasks = [
    task('T001', ['bootstrap.php']),
    task('T002', ['API/config/bootstrap.php']),
    task('T003', ['API/var/']),
    task('T004', ['API/config/bootstrap.php'], true),
  ]

  expect(matchTask(tasks, 'C:\\work\\demo\\API\\config\\bootstrap.php')?.id).toBe('T002')
  expect(matchTask(tasks, '/p/other/bootstrap.php')?.id).toBe('T001')
  expect(matchTask(tasks, '/p/API/var/jwt/key.pem')?.id).toBe('T003')
  expect(matchTask(tasks, '/p/README.md')).toBe(undefined)
})

test('pace and ETA need three tasks and five minutes', () => {
  expect(pace(2, 3_600_000, 10)).toBe(null)
  expect(pace(5, 60_000, 10)).toBe(null)
  expect(pace(6, 3_600_000, 12)).toEqual({ perHour: 6, etaMinutes: 120 })
  expect(pace(6, 3_600_000, 0)).toEqual({ perHour: 6, etaMinutes: null })
  expect(etaText(45)).toBe('45min')
  expect(etaText(200)).toBe('3h20')
  expect(etaText(3000)).toBe('2d')
})

test('the prompts name the task, the phase and the parallel tasks, and warn about a blocked phase', () => {
  const t = STRINGS.en
  const f = feature()

  expect(taskPrompt(t, f)).toContain('/speckit-implement Execute only task T001 of spec 001-demo: Create API/config/bootstrap.php')
  expect(phasePrompt(t, f)).toContain('phase Foundational')
  expect(parallelPrompt(t, f)).toContain('T001, T002')
  expect(phasePrompt(t, f, 'US1')).toContain('depends on Foundational')
  expect(phasePrompt(t, f, 'Nope')).toBe(null)
  expect(parallelPrompt(t, feature({ parallel: [] }))).toBe(null)
  expect(taskPrompt(STRINGS.pt, f)).toContain('Execute somente a tarefa T001')
})

test('with nothing left to run there is no prompt, and the flow command is only for the steps before the tasks', () => {
  const done = feature({ ...parseTasks('## Phase 1: A\n- [x] T001 a'), stages: stages() })

  expect(taskPrompt(STRINGS.en, done)).toBe(null)
  expect(phasePrompt(STRINGS.en, done)).toBe(null)
  expect(flowCommand(done)).toBe(null)
  expect(flowCommand(feature())).toBe(null)
  expect(flowCommand(feature({ ...parseTasks(''), stages: stages({ hasTasks: false }) }))).toBe('/speckit-tasks')
})
