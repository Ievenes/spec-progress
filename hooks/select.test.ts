import { expect, test } from 'claude-code/testing'

import type { Feature } from '../types'
import { branchOf, featureDirOf, matchArg, matchSpec, pickActive } from './select'

const spec = (id: string, done: number, total: number): Feature => ({
  id,
  done,
  total,
  phases: [],
  phase: null,
  next: null,
  parallel: [],
  tasks: [],
  stages: { hasSpec: true, hasPlan: true, hasTasks: true, clarifications: 0, checkDone: 0, checkTotal: 0 },
})

const LIST = [spec('001-alpha', 5, 5), spec('002-beta', 1, 4), spec('003-gamma', 0, 3)]
const NONE = { pinned: null, hints: [], edited: null }

test('the spec pinned by the person wins over everything', () => {
  const picked = pickActive(LIST, {
    pinned: '003-gamma',
    hints: [{ source: 'feature', value: 'specs/001-alpha' }],
    edited: '002-beta',
  })

  expect(picked?.feature.id).toBe('003-gamma')
  expect(picked?.source).toBe('pinned')
})

test('the project hints come in order, then the last edited, then the first with work left', () => {
  const hints = [
    { source: 'env', value: 'nope' },
    { source: 'feature', value: 'specs/002-beta' },
    { source: 'branch', value: 'feature/003-gamma' },
  ] as const

  expect(pickActive(LIST, { ...NONE, hints: [...hints], edited: '001-alpha' })?.source).toBe('feature')
  expect(pickActive(LIST, { ...NONE, hints: [hints[2]], edited: '001-alpha' })?.feature.id).toBe('003-gamma')
  expect(pickActive(LIST, { ...NONE, edited: '001-alpha' })?.source).toBe('edited')
  expect(pickActive(LIST, NONE)).toEqual({ feature: LIST[1], source: 'first' })
  // All done: the last one stands.
  expect(pickActive([spec('a', 1, 1), spec('b', 2, 2)], NONE)?.feature.id).toBe('b')
  expect(pickActive([], NONE)).toBe(undefined)
})

test('a stale pin or hint falls through to the next rule', () => {
  const picked = pickActive(LIST, { pinned: 'gone', hints: [{ source: 'branch', value: 'main' }], edited: null })

  expect(picked?.source).toBe('first')
})

test('hints match a folder, an id or a branch by its last segment', () => {
  expect(matchSpec(LIST, 'specs/002-beta/')?.id).toBe('002-beta')
  expect(matchSpec(LIST, "specs\\002-beta")?.id).toBe("002-beta")
  expect(matchSpec(LIST, 'feature/003-gamma')?.id).toBe('003-gamma')
  expect(matchSpec(LIST, 'main')).toBe(undefined)
  expect(matchSpec(LIST, '')).toBe(undefined)
})

test('the command argument matches an id, the start of one, or a part of it', () => {
  expect(matchArg(LIST, '002-beta')?.id).toBe('002-beta')
  expect(matchArg(LIST, '003')?.id).toBe('003-gamma')
  expect(matchArg(LIST, 'BETA')?.id).toBe('002-beta')
  expect(matchArg(LIST, 'zzz')).toBe(undefined)
})

test('reads the feature directory and the branch from the files Spec Kit and git write', () => {
  expect(featureDirOf('{ "feature_directory": "specs/001-x" }')).toBe('specs/001-x')
  expect(featureDirOf('{ "feature_directory": 3 }')).toBe(null)
  expect(featureDirOf('not json')).toBe(null)
  expect(branchOf('ref: refs/heads/feature/001-x\n')).toBe('feature/001-x')
  expect(branchOf('3f2a9c0d1b\n')).toBe(null)
})
