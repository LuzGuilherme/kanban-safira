'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Calendar, User } from 'lucide-react'
import { format, isPast, isToday } from 'date-fns'
import { pt } from 'date-fns/locale'
import { Task, TaskPriority, ASSIGNEES, PRIORITIES } from '@/lib/types'

interface TaskCardProps {
  task: Task
  onClick: () => void
  isDragging?: boolean
}

// Priority indicator styling
const priorityStyles: Record<TaskPriority, string> = {
  high: 'bg-red-500',
  medium: 'bg-amber-500',
  low: 'bg-green-500',
}

export default function TaskCard({ task, onClick, isDragging }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const assignee = ASSIGNEES.find((a) => a.id === task.assignee)
  const priority = PRIORITIES.find((p) => p.id === task.priority)
  const isOverdue = task.due_date && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date))
  const isDueToday = task.due_date && isToday(new Date(task.due_date))

  const dragging = isDragging || isSortableDragging

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`
        group relative bg-white rounded-lg p-4 cursor-pointer
        border border-[var(--color-border)]
        transition-all duration-150 ease-out
        hover:border-[var(--color-border-hover)]
        focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] focus-visible:outline-offset-2
        ${dragging ? 'shadow-lg opacity-90 scale-[1.02] rotate-[2deg]' : 'shadow-none'}
      `}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
    >
      {/* Priority indicator bar */}
      <div
        className={`absolute left-0 top-3 bottom-3 w-1 rounded-full ${priorityStyles[task.priority]}`}
        aria-label={`Prioridade: ${priority?.label}`}
      />

      {/* Card content */}
      <div className="pl-3">
        {/* Title */}
        <h3 className="text-[15px] font-medium text-[var(--color-text-primary)] leading-snug mb-2 line-clamp-2">
          {task.title}
        </h3>

        {/* Description preview */}
        {task.description && (
          <p className="text-sm text-[var(--color-text-secondary)] mb-3 line-clamp-2 leading-relaxed">
            {task.description}
          </p>
        )}

        {/* Meta info row */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Assignee */}
          {assignee && (
            <div className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)]">
              <User size={14} strokeWidth={2} />
              <span>{assignee.label}</span>
            </div>
          )}

          {/* Due date */}
          {task.due_date && (
            <div
              className={`
                flex items-center gap-1.5 text-sm
                ${isOverdue ? 'text-red-600' : isDueToday ? 'text-amber-600' : 'text-[var(--color-text-muted)]'}
              `}
            >
              <Calendar size={14} strokeWidth={2} />
              <span>
                {format(new Date(task.due_date), 'd MMM', { locale: pt })}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
