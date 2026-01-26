'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import {
  Task,
  TaskStatus,
  TaskPriority,
  Assignee,
  CreateTaskInput,
  COLUMNS,
  PRIORITIES,
  ASSIGNEES,
} from '@/lib/types'

interface TaskModalProps {
  task: Task | null
  defaultStatus?: TaskStatus
  isOpen: boolean
  onClose: () => void
  onSave: (data: CreateTaskInput & { id?: string }) => void
  onDelete?: (id: string) => void
}

export default function TaskModal({
  task,
  defaultStatus = 'todo',
  isOpen,
  onClose,
  onSave,
  onDelete,
}: TaskModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<TaskStatus>(defaultStatus)
  const [priority, setPriority] = useState<TaskPriority>('medium')
  const [assignee, setAssignee] = useState<Assignee>('guilherme')
  const [dueDate, setDueDate] = useState('')

  const isEditing = !!task

  // Populate form when task changes
  useEffect(() => {
    if (task) {
      setTitle(task.title)
      setDescription(task.description || '')
      setStatus(task.status)
      setPriority(task.priority)
      setAssignee(task.assignee)
      setDueDate(task.due_date ? format(new Date(task.due_date), 'yyyy-MM-dd') : '')
    } else {
      // Reset form for new task
      setTitle('')
      setDescription('')
      setStatus(defaultStatus)
      setPriority('medium')
      setAssignee('guilherme')
      setDueDate('')
    }
  }, [task, defaultStatus, isOpen])

  // Focus title input when modal opens
  useEffect(() => {
    if (isOpen && titleInputRef.current) {
      titleInputRef.current.focus()
    }
  }, [isOpen])

  // Handle escape key and click outside
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.addEventListener('mousedown', handleClickOutside)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.removeEventListener('mousedown', handleClickOutside)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    onSave({
      ...(task ? { id: task.id } : {}),
      title: title.trim(),
      description: description.trim() || undefined,
      status,
      priority,
      assignee,
      due_date: dueDate || undefined,
    })
  }

  const handleDelete = () => {
    if (task && onDelete) {
      onDelete(task.id)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div
        ref={modalRef}
        className="
          w-full max-w-lg bg-white rounded-lg shadow-lg
          animate-in fade-in-0 zoom-in-95 duration-200
        "
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
          <h2 id="modal-title" className="text-lg font-semibold text-[var(--color-text-primary)]">
            {isEditing ? 'Editar Tarefa' : 'Nova Tarefa'}
          </h2>
          <button
            onClick={onClose}
            className="
              p-2 rounded-md text-[var(--color-text-muted)]
              hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-secondary)]
              transition-colors duration-150
            "
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="flex flex-col gap-5">
            {/* Title */}
            <div>
              <label
                htmlFor="title"
                className="block text-sm font-medium text-[var(--color-text-primary)] mb-2"
              >
                Título
              </label>
              <input
                ref={titleInputRef}
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Nome da tarefa"
                className="
                  w-full h-11 px-4 rounded-md
                  border border-[var(--color-border)]
                  text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]
                  focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]
                  transition-colors duration-150
                "
                required
              />
            </div>

            {/* Description */}
            <div>
              <label
                htmlFor="description"
                className="block text-sm font-medium text-[var(--color-text-primary)] mb-2"
              >
                Descrição
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Adicionar descrição..."
                rows={3}
                className="
                  w-full px-4 py-3 rounded-md resize-none
                  border border-[var(--color-border)]
                  text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]
                  focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]
                  transition-colors duration-150
                "
              />
            </div>

            {/* Row: Status & Priority */}
            <div className="grid grid-cols-2 gap-4">
              {/* Status */}
              <div>
                <label
                  htmlFor="status"
                  className="block text-sm font-medium text-[var(--color-text-primary)] mb-2"
                >
                  Estado
                </label>
                <select
                  id="status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TaskStatus)}
                  className="
                    w-full h-11 px-4 rounded-md appearance-none
                    border border-[var(--color-border)] bg-white
                    text-[var(--color-text-primary)]
                    focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]
                    transition-colors duration-150
                    cursor-pointer
                  "
                >
                  {COLUMNS.map((col) => (
                    <option key={col.id} value={col.id}>
                      {col.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Priority */}
              <div>
                <label
                  htmlFor="priority"
                  className="block text-sm font-medium text-[var(--color-text-primary)] mb-2"
                >
                  Prioridade
                </label>
                <select
                  id="priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TaskPriority)}
                  className="
                    w-full h-11 px-4 rounded-md appearance-none
                    border border-[var(--color-border)] bg-white
                    text-[var(--color-text-primary)]
                    focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]
                    transition-colors duration-150
                    cursor-pointer
                  "
                >
                  {PRIORITIES.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row: Assignee & Due Date */}
            <div className="grid grid-cols-2 gap-4">
              {/* Assignee */}
              <div>
                <label
                  htmlFor="assignee"
                  className="block text-sm font-medium text-[var(--color-text-primary)] mb-2"
                >
                  Responsável
                </label>
                <select
                  id="assignee"
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value as Assignee)}
                  className="
                    w-full h-11 px-4 rounded-md appearance-none
                    border border-[var(--color-border)] bg-white
                    text-[var(--color-text-primary)]
                    focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]
                    transition-colors duration-150
                    cursor-pointer
                  "
                >
                  {ASSIGNEES.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Due Date */}
              <div>
                <label
                  htmlFor="dueDate"
                  className="block text-sm font-medium text-[var(--color-text-primary)] mb-2"
                >
                  Data Limite
                </label>
                <input
                  id="dueDate"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="
                    w-full h-11 px-4 rounded-md
                    border border-[var(--color-border)] bg-white
                    text-[var(--color-text-primary)]
                    focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]
                    transition-colors duration-150
                    cursor-pointer
                  "
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between mt-6 pt-5 border-t border-[var(--color-border)]">
            {/* Delete button (only when editing) */}
            {isEditing && onDelete ? (
              <button
                type="button"
                onClick={handleDelete}
                className="
                  flex items-center gap-2 px-4 py-2.5 rounded-md
                  text-red-600 text-sm font-medium
                  hover:bg-red-50
                  transition-colors duration-150
                "
              >
                <Trash2 size={16} />
                Eliminar
              </button>
            ) : (
              <div />
            )}

            {/* Save / Cancel buttons */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="
                  px-4 py-2.5 rounded-md
                  text-sm font-medium text-[var(--color-text-secondary)]
                  border border-[var(--color-border)]
                  hover:bg-[var(--color-bg-secondary)]
                  transition-colors duration-150
                "
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!title.trim()}
                className="
                  px-5 py-2.5 rounded-md
                  text-sm font-medium text-white
                  bg-[var(--color-accent)]
                  hover:bg-[var(--color-accent-hover)]
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-colors duration-150
                "
              >
                {isEditing ? 'Guardar' : 'Criar Tarefa'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
