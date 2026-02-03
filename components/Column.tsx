'use client'

import { useState, useRef, KeyboardEvent } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Plus } from 'lucide-react'
import { Task, TaskStatus } from '@/lib/types'
import TaskCard from './TaskCard'

interface ColumnProps {
  id: TaskStatus
  title: string
  tasks: Task[]
  onTaskClick: (task: Task) => void
  onAddTask: () => void
  onQuickAdd: (title: string) => void
}

// Column header accent colors - subtle indicator for each column
const columnAccents: Record<TaskStatus, string> = {
  todo: 'bg-slate-400',
  in_progress: 'bg-[var(--color-accent)]',
  done: 'bg-green-500',
}

export default function Column({
  id,
  title,
  tasks,
  onTaskClick,
  onAddTask,
  onQuickAdd,
}: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id })
  const [quickAddValue, setQuickAddValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const taskIds = tasks.map((task) => task.id)

  const handleQuickAddKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && quickAddValue.trim()) {
      onQuickAdd(quickAddValue.trim())
      setQuickAddValue('')
    }
    if (e.key === 'Escape') {
      setQuickAddValue('')
      inputRef.current?.blur()
    }
  }

  return (
    <div className="flex flex-col min-w-[300px] max-w-[340px] flex-1">
      {/* Column header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-3">
          {/* Status indicator dot */}
          <div className={`w-2.5 h-2.5 rounded-full ${columnAccents[id]}`} />
          <h2 className="text-[15px] font-semibold text-[var(--color-text-primary)]">
            {title}
          </h2>
          <span className="text-sm text-[var(--color-text-muted)] tabular-nums">
            {tasks.length}
          </span>
        </div>

        {/* Add task button */}
        <button
          onClick={onAddTask}
          className="
            p-1.5 rounded-md text-[var(--color-text-muted)]
            hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-secondary)]
            transition-colors duration-150
          "
          aria-label={`Adicionar tarefa a ${title}`}
        >
          <Plus size={18} strokeWidth={2} />
        </button>
      </div>

      {/* Quick Add Input */}
      <div className="mb-2 px-1">
        <input
          ref={inputRef}
          type="text"
          value={quickAddValue}
          onChange={(e) => setQuickAddValue(e.target.value)}
          onKeyDown={handleQuickAddKeyDown}
          placeholder="+ Adicionar tarefa..."
          className="
            w-full h-9 px-3 text-sm rounded-lg
            bg-transparent border border-transparent
            text-[var(--color-text-primary)]
            placeholder:text-[var(--color-text-muted)]
            hover:bg-[var(--color-surface)] hover:border-[var(--color-border)]
            focus:bg-[var(--color-surface)] focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]
            transition-all duration-150 outline-none
          "
        />
      </div>

      {/* Droppable area */}
      <div
        ref={setNodeRef}
        className={`
          flex-1 p-2 rounded-lg min-h-[200px]
          transition-colors duration-150
          ${isOver ? 'bg-[var(--color-accent-light)]' : 'bg-[var(--color-bg-secondary)]'}
        `}
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2">
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onClick={() => onTaskClick(task)}
              />
            ))}
          </div>
        </SortableContext>

        {/* Empty state */}
        {tasks.length === 0 && (
          <div className="flex items-center justify-center h-24 text-sm text-[var(--color-text-muted)]">
            Sem tarefas
          </div>
        )}
      </div>
    </div>
  )
}
