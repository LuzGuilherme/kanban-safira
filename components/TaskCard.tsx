'use client'

import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Calendar, AlertCircle, Repeat, Trash2 } from 'lucide-react'
import { format, isPast, isToday } from 'date-fns'
import { pt } from 'date-fns/locale'
import { Task, TaskPriority, ASSIGNEES, PRIORITIES, TAGS, RECURRENCES } from '@/lib/types'

interface TaskCardProps {
  task: Task
  onClick: () => void
  onDelete?: (id: string) => void
  isDragging?: boolean
}

// Priority indicator styling
const priorityStyles: Record<TaskPriority, string> = {
  high: 'bg-red-500',
  medium: 'bg-amber-500',
  low: 'bg-green-500',
}

// Avatar colors for assignees (fallback)
const avatarColors: Record<string, { bg: string; text: string }> = {
  guilherme: { bg: 'bg-indigo-100 dark:bg-indigo-900', text: 'text-indigo-700 dark:text-indigo-300' },
  safira: { bg: 'bg-pink-100 dark:bg-pink-900', text: 'text-pink-700 dark:text-pink-300' },
}

// Avatar component with image and fallback
function Avatar({ assigneeId, label, size = 24 }: { assigneeId: string; label: string; size?: number }) {
  const [imgError, setImgError] = useState(false)
  const assignee = ASSIGNEES.find(a => a.id === assigneeId)
  const initial = label.charAt(0).toUpperCase()
  const colors = avatarColors[assigneeId] || { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-700 dark:text-gray-300' }

  if (!assignee || imgError) {
    return (
      <div
        className={`
          flex items-center justify-center rounded-full font-semibold
          ${colors.bg} ${colors.text}
        `}
        style={{ width: size, height: size, fontSize: size * 0.45 }}
        title={label}
      >
        {initial}
      </div>
    )
  }

  return (
    <img
      src={assignee.avatar}
      alt={label}
      title={label}
      onError={() => setImgError(true)}
      className="rounded-full object-cover"
      style={{ width: size, height: size }}
    />
  )
}

export default function TaskCard({ task, onClick, onDelete, isDragging }: TaskCardProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
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
  const recurrence = RECURRENCES.find((r) => r.id === task.recurrence)
  const isOverdue = task.due_date && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date)) && task.status !== 'done'
  const isDueToday = task.due_date && isToday(new Date(task.due_date))
  const hasRecurrence = task.recurrence && task.recurrence !== 'none'

  const dragging = isDragging || isSortableDragging

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
        group relative bg-[var(--color-surface)] rounded-lg p-4 cursor-pointer
        border border-[var(--color-border)]
        transition-all duration-150 ease-out
        hover:border-[var(--color-border-hover)]
        focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] focus-visible:outline-offset-2
        ${dragging ? 'shadow-lg opacity-90 scale-[1.02] rotate-[2deg]' : 'shadow-none'}
        ${isOverdue ? 'ring-2 ring-red-200 dark:ring-red-900 bg-red-50/50 dark:bg-red-950/30' : ''}
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

      {/* Quick delete button - appears on hover */}
      {onDelete && !dragging && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {showDeleteConfirm ? (
            <div 
              className="flex items-center gap-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-1 shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(task.id)
                }}
                className="px-2 py-1 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded transition-colors"
              >
                Apagar
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowDeleteConfirm(false)
                }}
                className="px-2 py-1 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowDeleteConfirm(true)
              }}
              className="p-1.5 rounded-md text-[var(--color-text-muted)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors"
              title="Apagar tarefa"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      )}

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
            <Avatar assigneeId={assignee.id} label={assignee.label} size={24} />
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

          {/* Recurrence indicator */}
          {hasRecurrence && (
            <div
              className="flex items-center gap-1 text-sm px-2 py-0.5 rounded bg-indigo-100 text-indigo-700"
              title={recurrence?.label}
            >
              <Repeat size={12} strokeWidth={2.5} />
              <span className="text-xs font-medium">{recurrence?.label}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
