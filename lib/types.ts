export type TaskStatus = 'todo' | 'in_progress' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high'
export type Assignee = 'guilherme' | 'safira'

export interface Task {
  id: string
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  assignee: Assignee
  due_date: string | null
  tags: string[] | null
  position: number
  created_at: string
  updated_at: string
  completed_at: string | null
}

export interface CreateTaskInput {
  title: string
  description?: string
  status?: TaskStatus
  priority?: TaskPriority
  assignee?: Assignee
  due_date?: string
  tags?: string[]
}

export interface UpdateTaskInput {
  title?: string
  description?: string
  status?: TaskStatus
  priority?: TaskPriority
  assignee?: Assignee
  due_date?: string
  tags?: string[]
  position?: number
  completed_at?: string
}

export const COLUMNS: { id: TaskStatus; title: string }[] = [
  { id: 'todo', title: 'A Fazer' },
  { id: 'in_progress', title: 'Em Progresso' },
  { id: 'done', title: 'Concluído' },
]

export const PRIORITIES: { id: TaskPriority; label: string }[] = [
  { id: 'high', label: 'Alta' },
  { id: 'medium', label: 'Média' },
  { id: 'low', label: 'Baixa' },
]

export const ASSIGNEES: { id: Assignee; label: string; emoji: string }[] = [
  { id: 'guilherme', label: 'Guilherme', emoji: '👤' },
  { id: 'safira', label: 'Safira', emoji: '✨' },
]
