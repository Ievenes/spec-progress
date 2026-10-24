# spec-progress

A panel above the Claude Code prompt, made of one card per part inside a larger square (side by side on wide terminals, stacked on narrow ones), that follows your [Spec Kit](https://github.com/github/spec-kit) specs while you work: where the feature is in the flow, which phase and task is next, and buttons that put the command for it in the prompt box.

```
╭────────────────────────────────────────────────────────────────────────────────╮
│ ╭──────────────────────────────────────╮ ╭─────────────────────────────────────╮ │
│ │ Spec:   ◆ 001-my-feature  ███░░ 38/112 ▴ ✕│ │ Current task: ▸ T041  Create the folder │
│ │ Steps:  ✓ Spec ✓ Plan ● Implement     │ │               Foundational · ∥ 2 parallel │
│ ╰──────────────────────────────────────╯ │               ⚑ checkpoint: app boots… │
│ ╭──────────────────────────────────────╮ │               [ Next task ] [ Phase ]  │
│ │ Phases: ✓ Setup ● Foundational ⊘ US1 ★│ ╰─────────────────────────────────────╯ │
│ │ Groups: ✓ 2A ✓ 2B ● 2D 3/12 ○ 2E     │                                          │
│ ╰──────────────────────────────────────╯                                          │
│ ╭────────────────────────────────────────────────────────────────────────────╮ │
│ │ Others: 002-other 3/20                                                      │ │
│ ╰────────────────────────────────────────────────────────────────────────────╯ │
╰────────────────────────────────────────────────────────────────────────────────╯
```

## Install

You need Claude Code 2.1.275 or later and a Spec Kit project (a `specs/<feature>/` folder with a `spec.md`, `plan.md` or `tasks.md`). The repository is public, so no GitHub setup is needed.

### In the terminal

Type this at the Claude Code prompt:

```
/plugin install spec-progress --marketplace Ievenes/spec-progress
```

You will see, in order:

1. `Add marketplace?` naming `github:Ievenes/spec-progress` – answer `y`.
2. The plugin's details and the scopes – press Enter for **user** (every project), or pick another scope.
3. A screen with the options: **Panel language** and **Tell the model the active spec** (the defaults are fine).
4. `Installed spec-progress. Plugin is now active.` – the panel works in that session at once, with no restart, and in every session you start afterwards.

### From a shell

```
claude plugin install spec-progress --marketplace Ievenes/spec-progress
```

### In the desktop app

`/plugin` does not run there. Click **+** next to the prompt box, then **Plugins**, **Add marketplace** with `Ievenes/spec-progress`, then **Add plugin**.

### Using it

Open Claude Code in a folder with Spec Kit specs: the panel appears above the prompt. `/tasks-progress` prints the details, and `/config` changes the options at any time. Nothing is ever sent to the model or run without you pressing Enter, except the optional note of **Tell the model the active spec**.

### Update, check and remove

```
claude plugin update spec-progress      # restart Claude Code to apply it
claude plugin list                      # shows what is installed
claude plugin uninstall spec-progress
```

### Try it from a clone

```
git clone https://github.com/Ievenes/spec-progress
claude --plugin-dir ./spec-progress
```

`claude plugin test ./spec-progress` runs its tests.

## What it shows

- **Spec** – the feature folder, a progress bar, the count of finished tasks, and a `pinned` tag when you pinned it.
- **Steps** – the Spec Kit flow (Spec, Clarify, Plan, Tasks, Implement) read from the files of the spec folder, the checklists count, and the `[NEEDS CLARIFICATION]` markers left in `spec.md`. It shows from the first `spec.md`, before any `tasks.md` exists, with the next command (`/speckit-plan`, `/speckit-tasks`…) as a button.
- **Phases** – every phase of `tasks.md`: done `✓`, in progress `●` with its count, pending `○`, and held back `⊘`. A priority (`P1`) and the MVP star (`★`) ride after the name.
- **Groups** – the `###` groups of the current phase (`2A`…`2F`) with their own counts.
- **Current task** – a card with the next unchecked task: its id, the description shortened to its first clause (two lines at most, wrapped), then its phase, the `[P]` tasks that can run beside it (by id), the pace, and the phase checkpoint. The action buttons sit right under the card, outside its border.
- **Compact mode** – `▴` turns the panel into one line (spec, bar, phase, next task); `▾` brings it back.
- It sits above any other band (it never replaces them), updates when a spec file is edited, and shows a toast when a phase is completed.

## Running a spec

The buttons put a prompt in the box and **never send it**: read it, edit it, press Enter. What you had already typed stays, and the prompt goes after it.

| Button | Fills the box with |
| --- | --- |
| Next task | `/speckit-implement` for the next pending task only, to be marked `[X]` when done |
| Phase | the same for the whole current phase, stopping at its checkpoint |
| Parallel | the next task and the other `[P]` tasks of its phase, to run in parallel |
| List | opens a side pane with every phase; the current one open with its tasks |

A phase that waits for an earlier one gets a warning in the prompt. Before `tasks.md` exists the button is the Spec Kit command for the next step.

`/tasks-progress` does the same from the keyboard:

- `/tasks-progress` – details as text, which rule chose the active spec, and brings the panel back after the ✕ hid it.
- `/tasks-progress 002` – pins the panel to a spec (an id, or the start or a part of it). `/tasks-progress auto` unpins. The pin lasts for the session.
- `/tasks-progress next` and `/tasks-progress phase US1` – fill the prompt like the buttons.
- `/tasks-progress list` – opens the task list pane.

**Telling the model (optional).** The **Tell the model the active spec** option (`modelContext`, off by default) adds one short note to the system prompt: the active spec and its current phase, and the rule to follow `tasks.md` in order and check tasks off. It holds only the spec and the phase, so it changes as seldom as it can.

## Following the work live

- **Task in progress** – when the model edits a file that a pending task names between code ticks (`` `API/config/bootstrap.php` ``), that task is marked `▶`. The longest matching path wins.
- **Drift warning** – after three turns in a row that edit files without checking any task, the panel and the status line warn. Checking a task clears it.
- **Pace and ETA** – tasks per hour and the time left at that rate, shown only after three tasks and five minutes of work in the session, so it never guesses from nothing.

## Which spec it follows

The panel follows one spec at a time and lists the others on the "Others" row. The first rule that matches picks it:

1. **Pinned by you** – `/tasks-progress <spec>`.
2. **`SPECIFY_FEATURE`** – the environment variable Spec Kit uses.
3. **`.specify/feature.json`** – its `feature_directory`.
4. **The git branch** – `002-my-feature` or `feature/002-my-feature` selects `specs/002-my-feature`.
5. **The last spec file edited** in the session.
6. **The first spec with work left** (a spec with no tasks yet counts), then the last one if all are done.

The first three are read the way Spec Kit reads them. The branch is read again after every turn. In a git worktree (where `.git` is a file) there is no branch hint and the next rule applies.

## Languages

The panel and the prompts it fills are available in English, Portuguese, Spanish, French, German and Italian. The **Panel language** option (`/config`) defaults to `auto`, which follows Claude Code's language setting and then the system locale (`LANG`), falling back to English.

The `tasks.md` may be written in any language: phase, user-story, priority and checkpoint lines are read in English, Portuguese, Spanish, French, German, Italian, Chinese, Japanese and Korean, and wide characters are measured by the columns they take. Right-to-left languages are not supported yet.

## Good to know

- **Blocked phases are a guess.** A phase called Foundational (or "blocking", "pré-requisitos"…) with tasks left holds back the user-story phases after it. Other dependencies written in prose are not read.
- **Task in progress needs paths.** A task that names no file between code ticks is never marked `▶`.
- It finds the project from a sub-folder (it climbs to the folder with `.specify/` or `specs/`) and ignores checkboxes inside fenced code blocks. A spec folder is read again only when one of its files changed.

## License

MIT, see [LICENSE](LICENSE).
