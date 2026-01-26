'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Trash2, Check } from 'lucide-react'
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
  TAGS,
  TagId,
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
  const titleInputRef = useRef<HTMLInputElement>(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<TaskStatus>(defaultStatus)
  const [priority, setPriority] = useState<TaskPriority>('medium')
  const [assignee, setAssignee] = useState<Assignee>('guilherme')
  const [dueDate, setDueDate] = useState('')
  const [selectedTags, setSelectedTags] = useState<TagId[]>([])

  const isEditing = !!task

  useEffect(() => {
    if (task) {
      setTitle(task.title)
      setDescription(task.description || '')
      setStatus(task.status)
      setPriority(task.priority)
      setAssignee(task.assignee)
      setDueDate(task.due_date ? format(new Date(task.due_date), 'yyyy-MM-dd') : '')
      setSelectedTags((task.tags as TagId[]) || [])
    } else {
      setTitle('')
      setDescription('')
      setStatus(defaultStatus)
      setPriority('medium')
      setAssignee('guilherme')
      setDueDate('')
      setSelectedTags([])
    }
  }, [task, defaultStatus, isOpen])

  useEffect(() => {
    if (isOpen && titleInputRef.current) {
      setTimeout(() => titleInputRef.current?.focus(), 100)
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const toggleTag = (tagId: TagId) => {
    setSelectedTags(prev => 
      prev.includes(tagId)
        ? prev.filter(t => t !== tagId)
        : [...prev, tagId]
    )
  }

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
      tags: selectedTags.length > 0 ? selectedTags : undefined,
    })
  }

  if (!isOpen) return null

  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: '42px',
    padding: '0 12px',
    fontSize: '16px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    backgroundColor: 'white',
    boxSizing: 'border-box',
    outline: 'none',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '13px',
    fontWeight: 500,
    color: '#374151',
    marginBottom: '4px',
  }

  return (
    <>
      {/* Backdrop */}
      <div 
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9998,
          backgroundColor: 'rgba(0,0,0,0.3)',
          backdropFilter: 'blur(2px)',
        }}
      />
      
      {/* Card Modal - Centered */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 9999,
          width: 'calc(100% - 32px)',
          maxWidth: '420px',
          maxHeight: 'calc(100vh - 80px)',
          backgroundColor: 'white',
          borderRadius: '16px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
          display: 'grid',
          gridTemplateRows: 'auto 1fr auto',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ 
          padding: '16px 20px', 
          borderBottom: '1px solid #f3f4f6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <h2 style={{ fontSize: '17px', fontWeight: 600, margin: 0, color: '#111827' }}>
            {isEditing ? 'Editar Tarefa' : 'Nova Tarefa'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{ 
              padding: '6px', 
              background: 'none', 
              border: 'none', 
              cursor: 'pointer',
              borderRadius: '6px',
              display: 'flex',
            }}
          >
            <X size={20} color="#9ca3af" />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div style={{ overflow: 'auto', padding: '16px 20px' }}>
          <form id="task-form" onSubmit={handleSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={labelStyle}>Título</label>
                <input
                  ref={titleInputRef}
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Nome da tarefa"
                  required
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Descrição</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Opcional..."
                  rows={2}
                  style={{
                    ...inputStyle,
                    height: 'auto',
                    padding: '10px 12px',
                    resize: 'none',
                  }}
                />
              </div>

              {/* Tags Multi-select */}
              <div>
                <label style={labelStyle}>Etiquetas</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {TAGS.map((tag) => {
                    const isSelected = selectedTags.includes(tag.id)
                    // Map Tailwind classes to actual colors for inline styles
                    const colorMap: Record<string, { bg: string; bgSelected: string; text: string; border: string }> = {
                      trabalho: { bg: '#eff6ff', bgSelected: '#3b82f6', text: '#1d4ed8', border: '#93c5fd' },
                      pessoal: { bg: '#f0fdf4', bgSelected: '#22c55e', text: '#15803d', border: '#86efac' },
                      urgente: { bg: '#fef2f2', bgSelected: '#ef4444', text: '#b91c1c', border: '#fca5a5' },
                      ideia: { bg: '#faf5ff', bgSelected: '#a855f7', text: '#7e22ce', border: '#d8b4fe' },
                    }
                    const colors = colorMap[tag.id]
                    
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggleTag(tag.id)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '6px 12px',
                          fontSize: '13px',
                          fontWeight: 500,
                          borderRadius: '9999px',
                          border: `1px solid ${isSelected ? colors.bgSelected : colors.border}`,
                          backgroundColor: isSelected ? colors.bgSelected : colors.bg,
                          color: isSelected ? 'white' : colors.text,
                          cursor: 'pointer',
                          transition: 'all 150ms',
                        }}
                      >
                        {isSelected && <Check size={14} />}
                        {tag.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={labelStyle}>Estado</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as TaskStatus)}
                    style={{ ...inputStyle, cursor: 'pointer' }}
                  >
                    {COLUMNS.map((col) => (
                      <option key={col.id} value={col.id}>{col.title}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Prioridade</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as TaskPriority)}
                    style={{ ...inputStyle, cursor: 'pointer' }}
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={labelStyle}>Responsável</label>
                  <select
                    value={assignee}
                    onChange={(e) => setAssignee(e.target.value as Assignee)}
                    style={{ ...inputStyle, cursor: 'pointer' }}
                  >
                    {ASSIGNEES.map((a) => (
                      <option key={a.id} value={a.id}>{a.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Data Limite</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    style={{ ...inputStyle, cursor: 'pointer' }}
                  />
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div style={{ 
          padding: '14px 20px', 
          borderTop: '1px solid #f3f4f6',
          backgroundColor: '#fafafa',
          display: 'flex',
          gap: '10px',
          justifyContent: isEditing && onDelete ? 'space-between' : 'flex-end',
          alignItems: 'center',
        }}>
          {isEditing && onDelete && (
            <button
              type="button"
              onClick={() => onDelete(task!.id)}
              style={{
                padding: '10px 14px',
                fontSize: '14px',
                fontWeight: 500,
                color: '#dc2626',
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Trash2 size={16} />
              Eliminar
            </button>
          )}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 16px',
                fontSize: '14px',
                fontWeight: 500,
                color: '#6b7280',
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="task-form"
              disabled={!title.trim()}
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: 600,
                color: 'white',
                backgroundColor: title.trim() ? '#4f46e5' : '#d1d5db',
                border: 'none',
                borderRadius: '8px',
                cursor: title.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              {isEditing ? 'Guardar' : 'Criar'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
