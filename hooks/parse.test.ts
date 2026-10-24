import { expect, test } from 'claude-code/testing'

import type { Phase } from '../types'
import { STRINGS, LANGS, langOf } from './i18n'
import { brief, chips, clip, groupChips, parseTasks, width } from './parse'

const SAMPLE = [
  '# Tasks: Demo',
  '## Phase 1: Setup (Shared Infrastructure)',
  '- [x] T001 Create project structure',
  '- [x] T002 [P] Init deps',
  '## Phase 2: Foundational',
  '- [x] T003 Base models in src/models/base.py',
  '## Phase 3: User Story 1 - Login (Priority: P1) MVP',
  '- [ ] T004 [P] [US1] Create User model in src/models/user.py',
  '- [ ] T005 [P] [US1] Create Session model in src/models/session.py',
  '- [ ] T006 [US1] Implement AuthService in src/services/auth.py',
  'not a task line',
  '## Phase 4: User Story 2 - Reset',
  '- [ ] T007 [P] [US2] Reset flow',
].join('\r\n')

const phase = (label: string, done: number, total: number, extra: Partial<Phase> = {}): Phase => ({
  label,
  title: label,
  done,
  total,
  priority: null,
  isMvp: false,
  checkpoint: null,
  groups: [],
  blockedBy: null,
  ...extra,
})

test('counts phases and picks the next task with its parallel siblings', () => {
  const parsed = parseTasks(SAMPLE)

  expect(parsed.done).toBe(3)
  expect(parsed.total).toBe(7)
  expect(parsed.phases.map(p => p.label)).toEqual(['Setup', 'Foundational', 'US1', 'US2'])
  expect(parsed.phases[2]?.title).toBe('Login MVP')
  expect(parsed.phases[2]?.done).toBe(0)
  expect(parsed.phases[2]?.total).toBe(3)
  expect(parsed.next?.id).toBe('T004')
  expect(parsed.phase).toBe('US1')
  // T007 is [P] but sits in another phase.
  expect(parsed.parallel).toEqual(['T005'])
  expect(parsed.tasks.length).toBe(7)
  expect(parsed.tasks[0]?.isDone).toBe(true)
})

test('an empty or task-less file parses to nothing', () => {
  const parsed = parseTasks('')

  expect(parsed.total).toBe(0)
  expect(parsed.next).toBe(null)
  expect(parsed.tasks).toEqual([])
  expect(parseTasks('# Title\n\nJust prose.').phases).toEqual([])
})

test('a finished file has no next task', () => {
  const parsed = parseTasks('## Phase 1: Setup\n- [x] T001 Done\n- [X] T002 Done too')

  expect(parsed.done).toBe(2)
  expect(parsed.next).toBe(null)
  expect(parsed.parallel).toEqual([])
})

test('reads priority, MVP, groups, checkpoint, blocking and files; skips fenced examples', () => {
  const md = [
    '## Phase 1: Setup',
    '- [x] T001 a',
    '## Phase 2: Foundational (pré-requisitos bloqueantes)',
    '### 2A. Config (first)',
    '- [x] T002 b',
    '### 2B. Schema',
    '- [ ] T003 [P] Create `API/config/bootstrap.php` and `db/init.sql`',
    '- [ ] T004 [P] other',
    '**Checkpoint**: base ready',
    '## Phase 3: User Story 1 - Boot (Priority: P1) 🎯 MVP',
    '- [ ] T005 [US1] go',
    '## Parallel Example',
    '```',
    '- [ ] T999 inside a fence',
    '```',
  ].join('\n')
  const parsed = parseTasks(md)
  const [setup, found, story] = parsed.phases

  expect(parsed.total).toBe(5)
  expect(parsed.tasks.some(t => t.id === 'T999')).toBe(false)
  expect(found?.groups).toEqual([
    { label: '2A', done: 1, total: 1 },
    { label: '2B', done: 0, total: 2 },
  ])
  expect(found?.checkpoint).toBe('base ready')
  expect(story?.priority).toBe('P1')
  expect(story?.isMvp).toBe(true)
  expect(story?.blockedBy).toBe('Foundational')
  expect(setup?.blockedBy).toBe(null)
  expect(parsed.tasks[2]?.files).toEqual(['API/config/bootstrap.php', 'db/init.sql'])
  expect(parsed.tasks[2]?.group).toBe('2B')
  expect(parsed.next?.id).toBe('T003')
  expect(parsed.parallel).toEqual(['T004'])
})

test('a finished foundational phase blocks nothing', () => {
  const md = '## Phase 1: Foundational\n- [x] T001 a\n## Phase 2: User Story 1 - X\n- [ ] T002 b'

  expect(parseTasks(md).phases[1]?.blockedBy).toBe(null)
})

test('reads phase and story headings written in other languages', () => {
  const md = [
    '## Fase 1: Configuração (infraestrutura compartilhada)',
    '- [x] T001 Criar a estrutura',
    '## Fase 2: História de Usuário 1 - Subir o ambiente (Prioridade: P1) 🎯 MVP',
    '- [ ] T002 [US1] Subir tudo',
    '## Phase 3 : Récit utilisateur 2 - Se connecter (Priorité : P2)',
    '- [ ] T003 [US2] Connexion',
    '## 阶段 4：用户故事 3 - 登录 (优先级: P3)',
    '- [ ] T004 [US3] 实现登录流程。然后测试',
    '**Ponto de controle**: pronto',
  ].join('\n')
  const phases = parseTasks(md).phases

  expect(phases.map(p => p.label)).toEqual(['Configuração', 'US1', 'US2', 'US3'])
  expect(phases[1]?.title).toBe('Subir o ambiente MVP')
  expect(phases[1]?.priority).toBe('P1')
  expect(phases[2]?.title).toBe('Se connecter')
  expect(phases[3]?.title).toBe('登录')
  expect(phases[3]?.checkpoint).toBe('pronto')
})

test('brief keeps the first clause, without ticks, and cuts long ones', () => {
  expect(brief('Criar `a.sql` com seção: x, y, z')).toBe('Criar a.sql com seção')
  expect(brief('Rodar testes (research D3)')).toBe('Rodar testes')
  expect(brief('实现登录流程。然后测试')).toBe('实现登录流程')
  expect(brief('x'.repeat(80), 10)).toBe('xxxxxxxxx…')
})

test('width counts CJK as two columns and clip never splits a character', () => {
  expect(width('abc')).toBe(3)
  expect(width('登录')).toBe(4)
  expect(width('não')).toBe(3)
  expect(clip('登录登录登录', 7)).toBe('登录登…')
  expect(width(clip('登录登录登录', 7))).toBeLessThanOrEqual(7)
})

test('chips mark done, current, blocked and todo phases, with priority and MVP', () => {
  const phases = [
    phase('Setup', 4, 4),
    phase('Foundational', 2, 5),
    phase('US1', 0, 3, { priority: 'P1', isMvp: true, blockedBy: 'Foundational' }),
    phase('US2', 0, 3),
  ]

  expect(chips(phases, 'Foundational', 80).map(c => c.text)).toEqual([
    '✓ Setup',
    '● Foundational 2/5',
    '⊘ US1 P1 ★',
    '○ US2',
  ])
  expect(chips(phases, 'Foundational', 80).map(c => c.kind)).toEqual(['done', 'current', 'blocked', 'todo'])
})

test('chips fold finished phases and the tail when narrow', () => {
  const phases = [
    phase('Setup', 4, 4),
    phase('Foundational', 2, 5),
    phase('US1', 0, 3),
    phase('US2', 0, 3),
  ]

  expect(chips(phases, 'Foundational', 30).map(c => c.kind)).toEqual(['done', 'current', 'more'])
})

test('group chips mark the group the next task sits in', () => {
  const groups = [
    { label: '2A', done: 3, total: 3 },
    { label: '2D', done: 3, total: 12 },
    { label: '2E', done: 0, total: 4 },
  ]

  expect(groupChips(groups, '2D').map(c => c.text)).toEqual(['✓ 2A', '● 2D 3/12', '○ 2E'])
})

test('every language carries every string, nested ones included, and locales map to a language', () => {
  const keys = Object.keys(STRINGS.en).sort()
  for (const l of LANGS) {
    expect(Object.keys(STRINGS[l]).sort()).toEqual(keys)
    expect(Object.keys(STRINGS[l].sources).sort()).toEqual(Object.keys(STRINGS.en.sources).sort())
    expect(Object.keys(STRINGS[l].stepNames).sort()).toEqual(Object.keys(STRINGS.en.stepNames).sort())
    // The placeholders a prompt needs survive translation.
    expect(STRINGS[l].promptTask).toContain('{id}')
    expect(STRINGS[l].promptTask).toContain('{spec}')
    expect(STRINGS[l].promptParallel).toContain('{ids}')
    expect(STRINGS[l].promptBlocked).toContain('{blocker}')
  }

  expect(langOf('pt_BR.UTF-8')).toBe('pt')
  expect(langOf('es-MX')).toBe('es')
  expect(langOf('Português')).toBe('pt')
  expect(langOf('Portuguese')).toBe('pt')
  expect(langOf('de')).toBe('de')
  expect(langOf('ja_JP.UTF-8')).toBe('en')
  expect(langOf(undefined)).toBe('en')
})
