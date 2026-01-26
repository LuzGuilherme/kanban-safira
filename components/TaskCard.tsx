'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Calendar, AlertCircle } from 'lucide-react'
import { format, isPast, isToday } from 'date-fns'
import { pt } from 'date-fns/locale'
import { Task, TaskPriority, ASSIGNEES, PRIORITIES, TAGS } from '@/lib/types'

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

// Avatar colors for assignees
const avatarColors: Record<string, { bg: string; text: string }> = {
  guilherme: { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  safira: { bg: 'bg-pink-100', text: 'text-pink-700' },
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
  const isOverdue = task.due_date && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date)) && task.status !== 'done'
  const isDueToday = task.due_date && isToday(new Date(task.due_date))

  const dragging = isDragging || isSortableDragging

  // Get avatar initial
  const getInitial = (name: string) => name.charAt(0).toUpperCase()

  // Get tag definitions for task tags
  const taskTags = (task.tags || [])
    .map(tagId => TAGS.find(t => t.id === tagId))
    .filter(Boolean)

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
        ${isOverdue ? 'ring-2 ring-red-200 bg-red-50/50' : ''}
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
        {/* Tags - displayed above title */}
        {taskTags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {taskTags.map((tag) => tag && (
              <span
                key={tag.id}
                className={`
                  inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium
                  ${tag.bgColor} ${tag.textColor}
                `}
              >
                {tag.label}
              </span>
            ))}
          </div>
        )}

        {/* Title with overdue indicator */}
        <div className="flex items-start gap-2 mb-2">
          {isOverdue && (
            <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
          )}
          <h3 className={`text-[15px] font-medium leading-snug line-clamp-2 ${isOverdue ? 'text-red-700' : 'text-[var(--color-text-primary)]'}`}>
            {task.title}
          </h3>
        </div>

        {/* Description preview */}
        {task.description && (
          <p className="text-sm text-[var(--color-text-secondary)] mb-3 line-clamp-2 leading-relaxed">
            {task.description}
          </p>
        )}

        {/* Meta info row */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Assignee Avatar */}
          {assignee && (
            <div
              className={`
                flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold
                ${avatarColors[assignee.id]?.bg || 'bg-gray-100'}
                ${avatarColors[assignee.id]?.text || 'text-gray-700'}
              `}
              title={assignee.label}
            >
              {getInitial(assignee.label)}
            </div>
          )}

          {/* Due date */}
          {task.due_date && (
            <div
              className={`
                flex items-center gap-1.5 text-sm px-2 py-0.5 rounded
                ${isOverdue 
                  ? 'bg-red-100 text-red-700 font-medium' 
                  : isDueToday 
                    ? 'bg-amber-100 text-amber-700 font-medium' 
                    : 'text-[var(--color-text-muted)]'}
              `}
            >
              <Calendar size={14} strokeWidth={2} />
              <span>
                {isOverdue ? 'Atrasado • ' : isDueToday ? 'Hoje • ' : ''}
                {format(new Date(task.due_date), 'd MMM', { locale: pt })}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
