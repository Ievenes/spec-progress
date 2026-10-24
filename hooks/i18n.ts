export type Lang = 'en' | 'pt' | 'es' | 'fr' | 'de' | 'it'

export const LANGS: readonly Lang[] = ['en', 'pt', 'es', 'fr', 'de', 'it']

// How the active spec was chosen, as the command reports it.
export type SourceNames = {
  pinned: string
  env: string
  feature: string
  branch: string
  edited: string
  first: string
}

// The steps of the Spec Kit flow.
export type StepNames = {
  spec: string
  clarify: string
  plan: string
  tasks: string
  implement: string
}

export type Strings = {
  spec: string
  phases: string
  current: string
  others: string
  steps: string
  next: string
  groups: string
  allDone: string
  parallel: string
  phaseDone: string
  noTasks: string
  command: string
  // {id}, {query}, {list}, {how}, {n}, {t}, {cmd}, {phase}, {blocker}, {title}, {ids}, {spec}, {text}
  // are filled in by the caller.
  pinned: string
  pinSet: string
  pinCleared: string
  noMatch: string
  noPhase: string
  via: string
  working: string
  checklists: string
  checkpoint: string
  btnNext: string
  btnPhase: string
  btnParallel: string
  btnList: string
  paneTitle: string
  drift: string
  waiting: string
  perHour: string
  eta: string
  filled: string
  nothingToRun: string
  promptTask: string
  promptPhase: string
  promptParallel: string
  promptBlocked: string
  stepNames: StepNames
  sources: SourceNames
}

export const STRINGS: Record<Lang, Strings> = {
  en: {
    spec: 'Spec:',
    phases: 'Phases:',
    current: 'Current task:',
    others: 'Others:',
    steps: 'Steps:',
    next: 'Next:',
    groups: 'Groups:',
    allDone: 'All tasks done',
    parallel: 'parallel',
    phaseDone: 'Phase done',
    noTasks: 'No specs/*/tasks.md found in this project.',
    command:
      'Spec Kit progress; <spec> pins one, auto unpins, next and phase <label> fill the prompt, list opens the task list',
    pinned: 'pinned',
    pinSet: 'Pinned to {id}. Use /tasks-progress auto to follow the project again.',
    pinCleared: 'Unpinned: following the spec the project says is current.',
    noMatch: 'No spec matches "{query}". Available: {list}',
    noPhase: 'No phase matches "{query}". Available: {list}',
    via: 'Active spec chosen by: {how}',
    working: 'in progress',
    checklists: 'checklists',
    checkpoint: 'checkpoint',
    btnNext: 'Next task',
    btnPhase: 'Phase',
    btnParallel: 'Parallel',
    btnList: 'List',
    paneTitle: 'Tasks',
    drift: '⚠ {n} turns editing files without checking a task',
    waiting: 'waiting for {phase}',
    perHour: '{n} tasks/h',
    eta: 'ETA {t}',
    filled: 'Prompt filled in the box: review it and press Enter.',
    nothingToRun: 'Nothing left to run in this spec.',
    promptTask: 'Execute only task {id} of spec {spec}: {text}. Mark it [X] in tasks.md when it is done, then stop.',
    promptPhase:
      'Execute only phase {phase} ({title}) of spec {spec}, task by task. Mark each task [X] in tasks.md and stop at the phase checkpoint.',
    promptParallel:
      'Execute tasks {ids} of spec {spec} in parallel (they are marked [P] and independent). Mark each one [X] in tasks.md when it is done.',
    promptBlocked: 'Note: phase {phase} depends on {blocker}, which still has tasks left; confirm before starting.',
    stepNames: { spec: 'Spec', clarify: 'Clarify', plan: 'Plan', tasks: 'Tasks', implement: 'Implement' },
    sources: {
      pinned: 'pinned by you',
      env: 'SPECIFY_FEATURE variable',
      feature: '.specify/feature.json',
      branch: 'git branch',
      edited: 'last tasks.md edited',
      first: 'first one with tasks left',
    },
  },
  pt: {
    spec: 'Spec:',
    phases: 'Fases:',
    current: 'Tarefa atual:',
    others: 'Outras:',
    steps: 'Etapas:',
    next: 'Próximo:',
    groups: 'Grupos:',
    allDone: 'Todas as tarefas concluídas',
    parallel: 'em paralelo',
    phaseDone: 'Fase concluída',
    noTasks: 'Nenhum specs/*/tasks.md encontrado neste projeto.',
    command:
      'Progresso do Spec Kit; <spec> fixa uma, auto solta, next e phase <fase> preenchem o prompt, list abre a lista',
    pinned: 'fixada',
    pinSet: 'Fixada em {id}. Use /tasks-progress auto para voltar a seguir o projeto.',
    pinCleared: 'Fixação removida: seguindo a spec que o projeto indica como atual.',
    noMatch: 'Nenhuma spec corresponde a "{query}". Disponíveis: {list}',
    noPhase: 'Nenhuma fase corresponde a "{query}". Disponíveis: {list}',
    via: 'Spec ativa escolhida por: {how}',
    working: 'em andamento',
    checklists: 'checklists',
    checkpoint: 'checkpoint',
    btnNext: 'Próxima tarefa',
    btnPhase: 'Fase',
    btnParallel: 'Paralelas',
    btnList: 'Lista',
    paneTitle: 'Tarefas',
    drift: '⚠ {n} turnos editando arquivos sem marcar nenhuma tarefa',
    waiting: 'aguarda {phase}',
    perHour: '{n} tarefas/h',
    eta: 'ETA {t}',
    filled: 'Prompt preenchido no campo: revise e aperte Enter.',
    nothingToRun: 'Não há mais nada a executar nesta spec.',
    promptTask:
      'Execute somente a tarefa {id} da spec {spec}: {text}. Marque-a como [X] no tasks.md quando concluir e pare.',
    promptPhase:
      'Execute somente a fase {phase} ({title}) da spec {spec}, tarefa por tarefa. Marque cada tarefa como [X] no tasks.md e pare no checkpoint da fase.',
    promptParallel:
      'Execute as tarefas {ids} da spec {spec} em paralelo (estão marcadas [P] e são independentes). Marque cada uma como [X] no tasks.md ao concluir.',
    promptBlocked:
      'Atenção: a fase {phase} depende de {blocker}, que ainda tem tarefas pendentes; confirme antes de começar.',
    stepNames: { spec: 'Spec', clarify: 'Clarificar', plan: 'Plano', tasks: 'Tarefas', implement: 'Implementar' },
    sources: {
      pinned: 'fixada por você',
      env: 'variável SPECIFY_FEATURE',
      feature: '.specify/feature.json',
      branch: 'branch do git',
      edited: 'último tasks.md editado',
      first: 'primeira com tarefas pendentes',
    },
  },
  es: {
    spec: 'Spec:',
    phases: 'Fases:',
    current: 'Tarea actual:',
    others: 'Otras:',
    steps: 'Etapas:',
    next: 'Siguiente:',
    groups: 'Grupos:',
    allDone: 'Todas las tareas completadas',
    parallel: 'en paralelo',
    phaseDone: 'Fase completada',
    noTasks: 'No se encontró ningún specs/*/tasks.md en este proyecto.',
    command:
      'Progreso de Spec Kit; <spec> fija una, auto la suelta, next y phase <fase> rellenan el prompt, list abre la lista',
    pinned: 'fijada',
    pinSet: 'Fijada en {id}. Use /tasks-progress auto para volver a seguir el proyecto.',
    pinCleared: 'Fijación quitada: siguiendo la spec que el proyecto marca como actual.',
    noMatch: 'Ninguna spec coincide con "{query}". Disponibles: {list}',
    noPhase: 'Ninguna fase coincide con "{query}". Disponibles: {list}',
    via: 'Spec activa elegida por: {how}',
    working: 'en curso',
    checklists: 'checklists',
    checkpoint: 'checkpoint',
    btnNext: 'Siguiente tarea',
    btnPhase: 'Fase',
    btnParallel: 'Paralelas',
    btnList: 'Lista',
    paneTitle: 'Tareas',
    drift: '⚠ {n} turnos editando archivos sin marcar ninguna tarea',
    waiting: 'espera {phase}',
    perHour: '{n} tareas/h',
    eta: 'ETA {t}',
    filled: 'Prompt rellenado en el campo: revíselo y pulse Enter.',
    nothingToRun: 'No queda nada por ejecutar en esta spec.',
    promptTask:
      'Ejecute solo la tarea {id} de la spec {spec}: {text}. Márquela como [X] en tasks.md al terminar y pare.',
    promptPhase:
      'Ejecute solo la fase {phase} ({title}) de la spec {spec}, tarea por tarea. Marque cada tarea como [X] en tasks.md y pare en el checkpoint de la fase.',
    promptParallel:
      'Ejecute las tareas {ids} de la spec {spec} en paralelo (están marcadas [P] y son independientes). Marque cada una como [X] en tasks.md al terminar.',
    promptBlocked:
      'Atención: la fase {phase} depende de {blocker}, que aún tiene tareas pendientes; confirme antes de empezar.',
    stepNames: { spec: 'Spec', clarify: 'Aclarar', plan: 'Plan', tasks: 'Tareas', implement: 'Implementar' },
    sources: {
      pinned: 'fijada por usted',
      env: 'variable SPECIFY_FEATURE',
      feature: '.specify/feature.json',
      branch: 'rama de git',
      edited: 'último tasks.md editado',
      first: 'la primera con tareas pendientes',
    },
  },
  fr: {
    spec: 'Spec :',
    phases: 'Phases :',
    current: 'Tâche en cours :',
    others: 'Autres :',
    steps: 'Étapes :',
    next: 'Suivant :',
    groups: 'Groupes :',
    allDone: 'Toutes les tâches sont terminées',
    parallel: 'en parallèle',
    phaseDone: 'Phase terminée',
    noTasks: 'Aucun specs/*/tasks.md trouvé dans ce projet.',
    command:
      "Avancement Spec Kit ; <spec> en épingle une, auto la relâche, next et phase <phase> remplissent le prompt, list ouvre la liste",
    pinned: 'épinglée',
    pinSet: 'Épinglée sur {id}. Utilisez /tasks-progress auto pour suivre de nouveau le projet.',
    pinCleared: 'Épingle retirée : on suit la spec que le projet indique comme courante.',
    noMatch: 'Aucune spec ne correspond à « {query} ». Disponibles : {list}',
    noPhase: 'Aucune phase ne correspond à « {query} ». Disponibles : {list}',
    via: 'Spec active choisie par : {how}',
    working: 'en cours',
    checklists: 'checklists',
    checkpoint: 'checkpoint',
    btnNext: 'Tâche suivante',
    btnPhase: 'Phase',
    btnParallel: 'Parallèles',
    btnList: 'Liste',
    paneTitle: 'Tâches',
    drift: '⚠ {n} tours à modifier des fichiers sans cocher de tâche',
    waiting: 'attend {phase}',
    perHour: '{n} tâches/h',
    eta: 'ETA {t}',
    filled: 'Prompt placé dans le champ : relisez-le et appuyez sur Entrée.',
    nothingToRun: "Il ne reste rien à exécuter dans cette spec.",
    promptTask:
      "Exécutez uniquement la tâche {id} de la spec {spec} : {text}. Cochez-la [X] dans tasks.md une fois terminée, puis arrêtez-vous.",
    promptPhase:
      "Exécutez uniquement la phase {phase} ({title}) de la spec {spec}, tâche par tâche. Cochez chaque tâche [X] dans tasks.md et arrêtez-vous au checkpoint de la phase.",
    promptParallel:
      "Exécutez les tâches {ids} de la spec {spec} en parallèle (elles sont marquées [P] et indépendantes). Cochez chacune [X] dans tasks.md une fois terminée.",
    promptBlocked:
      "Attention : la phase {phase} dépend de {blocker}, qui a encore des tâches restantes ; confirmez avant de commencer.",
    stepNames: { spec: 'Spec', clarify: 'Clarifier', plan: 'Plan', tasks: 'Tâches', implement: 'Implémenter' },
    sources: {
      pinned: 'épinglée par vous',
      env: 'variable SPECIFY_FEATURE',
      feature: '.specify/feature.json',
      branch: 'branche git',
      edited: 'dernier tasks.md modifié',
      first: 'la première avec des tâches restantes',
    },
  },
  de: {
    spec: 'Spec:',
    phases: 'Phasen:',
    current: 'Aktuelle Aufgabe:',
    others: 'Weitere:',
    steps: 'Schritte:',
    next: 'Als Nächstes:',
    groups: 'Gruppen:',
    allDone: 'Alle Aufgaben erledigt',
    parallel: 'parallel',
    phaseDone: 'Phase abgeschlossen',
    noTasks: 'Kein specs/*/tasks.md in diesem Projekt gefunden.',
    command:
      'Spec-Kit-Fortschritt; <spec> heftet eine an, auto löst sie, next und phase <Phase> füllen den Prompt, list öffnet die Liste',
    pinned: 'angeheftet',
    pinSet: 'Auf {id} angeheftet. Mit /tasks-progress auto folgt das Panel wieder dem Projekt.',
    pinCleared: 'Nicht mehr angeheftet: Es wird die Spec verfolgt, die das Projekt als aktuell angibt.',
    noMatch: 'Keine Spec passt zu "{query}". Verfügbar: {list}',
    noPhase: 'Keine Phase passt zu "{query}". Verfügbar: {list}',
    via: 'Aktive Spec gewählt durch: {how}',
    working: 'in Arbeit',
    checklists: 'Checklisten',
    checkpoint: 'Checkpoint',
    btnNext: 'Nächste Aufgabe',
    btnPhase: 'Phase',
    btnParallel: 'Parallel',
    btnList: 'Liste',
    paneTitle: 'Aufgaben',
    drift: '⚠ {n} Runden mit Dateiänderungen, ohne eine Aufgabe abzuhaken',
    waiting: 'wartet auf {phase}',
    perHour: '{n} Aufgaben/h',
    eta: 'ETA {t}',
    filled: 'Prompt im Eingabefeld: prüfen und Enter drücken.',
    nothingToRun: 'In dieser Spec ist nichts mehr auszuführen.',
    promptTask:
      'Führe nur Aufgabe {id} der Spec {spec} aus: {text}. Hake sie in tasks.md mit [X] ab, sobald sie fertig ist, und halte dann an.',
    promptPhase:
      'Führe nur Phase {phase} ({title}) der Spec {spec} aus, Aufgabe für Aufgabe. Hake jede Aufgabe in tasks.md mit [X] ab und halte am Checkpoint der Phase an.',
    promptParallel:
      'Führe die Aufgaben {ids} der Spec {spec} parallel aus (sie sind mit [P] markiert und unabhängig). Hake jede in tasks.md mit [X] ab, sobald sie fertig ist.',
    promptBlocked:
      'Hinweis: Phase {phase} hängt von {blocker} ab, die noch offene Aufgaben hat; vor dem Start bestätigen.',
    stepNames: { spec: 'Spec', clarify: 'Klären', plan: 'Plan', tasks: 'Aufgaben', implement: 'Umsetzen' },
    sources: {
      pinned: 'von Ihnen angeheftet',
      env: 'Variable SPECIFY_FEATURE',
      feature: '.specify/feature.json',
      branch: 'Git-Branch',
      edited: 'zuletzt bearbeitete tasks.md',
      first: 'die erste mit offenen Aufgaben',
    },
  },
  it: {
    spec: 'Spec:',
    phases: 'Fasi:',
    current: 'Attività corrente:',
    others: 'Altre:',
    steps: 'Passi:',
    next: 'Prossimo:',
    groups: 'Gruppi:',
    allDone: 'Tutte le attività completate',
    parallel: 'in parallelo',
    phaseDone: 'Fase completata',
    noTasks: 'Nessun specs/*/tasks.md trovato in questo progetto.',
    command:
      "Avanzamento Spec Kit; <spec> ne fissa una, auto la rilascia, next e phase <fase> riempiono il prompt, list apre l'elenco",
    pinned: 'fissata',
    pinSet: 'Fissata su {id}. Usa /tasks-progress auto per tornare a seguire il progetto.',
    pinCleared: 'Fissaggio rimosso: si segue la spec che il progetto indica come corrente.',
    noMatch: 'Nessuna spec corrisponde a "{query}". Disponibili: {list}',
    noPhase: 'Nessuna fase corrisponde a "{query}". Disponibili: {list}',
    via: 'Spec attiva scelta da: {how}',
    working: 'in corso',
    checklists: 'checklist',
    checkpoint: 'checkpoint',
    btnNext: 'Prossima attività',
    btnPhase: 'Fase',
    btnParallel: 'Parallele',
    btnList: 'Elenco',
    paneTitle: 'Attività',
    drift: '⚠ {n} turni a modificare file senza spuntare nessuna attività',
    waiting: 'attende {phase}',
    perHour: '{n} attività/h',
    eta: 'ETA {t}',
    filled: 'Prompt inserito nel campo: rivedilo e premi Invio.',
    nothingToRun: 'Non resta nulla da eseguire in questa spec.',
    promptTask:
      "Esegui solo l'attività {id} della spec {spec}: {text}. Spuntala [X] in tasks.md quando è finita, poi fermati.",
    promptPhase:
      'Esegui solo la fase {phase} ({title}) della spec {spec}, attività per attività. Spunta ogni attività [X] in tasks.md e fermati al checkpoint della fase.',
    promptParallel:
      'Esegui le attività {ids} della spec {spec} in parallelo (sono marcate [P] e indipendenti). Spunta ognuna [X] in tasks.md quando è finita.',
    promptBlocked:
      'Attenzione: la fase {phase} dipende da {blocker}, che ha ancora attività da fare; conferma prima di iniziare.',
    stepNames: { spec: 'Spec', clarify: 'Chiarire', plan: 'Piano', tasks: 'Attività', implement: 'Implementare' },
    sources: {
      pinned: 'fissata da te',
      env: 'variabile SPECIFY_FEATURE',
      feature: '.specify/feature.json',
      branch: 'branch git',
      edited: 'ultimo tasks.md modificato',
      first: 'la prima con attività rimaste',
    },
  },
}

// "pt_BR.UTF-8", "pt-BR", "Portuguese" -> 'pt'; what is not supported -> 'en'.
export const langOf = (value: unknown): Lang => {
  if (typeof value !== 'string') return 'en'
  const v = value.trim().toLowerCase()
  const code = LANGS.find(l => v === l || v.startsWith(`${l}_`) || v.startsWith(`${l}-`) || v.startsWith(`${l}.`))
  if (code) return code
  if (v.startsWith('portugu')) return 'pt'
  if (v.startsWith('espa') || v.startsWith('spanish')) return 'es'
  if (v.startsWith('fran') || v.startsWith('french')) return 'fr'
  if (v.startsWith('deutsch') || v.startsWith('german')) return 'de'
  if (v.startsWith('ital')) return 'it'

  return 'en'
}

export const fill = (text: string, values: Record<string, string>): string =>
  text.replace(/\{(\w+)\}/g, (whole, key: string) => values[key] ?? whole)
