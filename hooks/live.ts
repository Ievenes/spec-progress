import type { Task } from '../types'

// The pending task whose files include the one just edited: the longest path
// that matches wins ("API/config/bootstrap.php" over "bootstrap.php").
export const matchTask = (tasks: Task[], file: string): Task | undefined => {
  const edited = file.replace(/\\/g, '/').toLowerCase()
  let best: { task: Task; length: number } | undefined

  for (const task of tasks) {
    if (task.isDone) continue
    for (const path of task.files) {
      const p = path.toLowerCase()
      const isHit = p.endsWith('/')
        ? edited.includes(`/${p}`) || edited.startsWith(p)
        : edited === p || edited.endsWith(`/${p}`)
      if (isHit && (!best || p.length > best.length)) best = { task, length: p.length }
    }
  }

  return best?.task
}

export type Pace = { perHour: number; etaMinutes: number | null }

// Tasks a session got done per hour, and the time the rest would take at that
// rate. Nothing before three tasks and five minutes: fewer say too little.
export const pace = (completed: number, elapsedMs: number, remaining: number): Pace | null => {
  if (completed < 3 || elapsedMs < 5 * 60_000) return null

  const perHour = completed / (elapsedMs / 3_600_000)

  return {
    perHour: Math.round(perHour * 10) / 10,
    etaMinutes: remaining > 0 ? Math.round((remaining / perHour) * 60) : null,
  }
}

// 45 -> "45min", 200 -> "3h20", 3000 -> "2d".
export const etaText = (minutes: number): string => {
  if (minutes < 60) return `${Math.max(1, minutes)}min`
  if (minutes < 48 * 60) return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}`

  return `${Math.round(minutes / 1440)}d`
}
