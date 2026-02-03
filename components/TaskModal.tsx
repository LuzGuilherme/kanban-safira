'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Trash2, Check, ChevronDown, ChevronUp, Repeat } from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { pt } from 'date-fns/locale'
import {
  Task,
  TaskStatus,
  TaskPriority,
  Assignee,
  Recurrence,
  CreateTaskInput,
  ActivityLog,
  COLUMNS,
  PRIORITIES,
  ASSIGNEES,
  TAGS,
  TagId,
  RECURRENCES,
} from '@/lib/types'
import { getTaskActivity, formatActivityMessage, getActivityIcon } from '@/lib/activity'
import { useTheme } from '@/lib/ThemeContext'

interface TaskModalProps {
  task: Task | null
  defaultStatus?: TaskStatus
  defaultDueDate?: string
  isOpen: boolean
  onClose: () => void
  onSave: (data: CreateTaskInput & { id?: string }) => void
  onDelete?: (id: string) => void
}

export default function TaskModal({
  task,
  defaultStatus = 'todo',
  defaultDueDate,
  isOpen,
  onClose,
  onSave,
  onDelete,
}: TaskModalProps) {
  const titleInputRef = useRef<HTMLInputElement>(null)
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<TaskStatus>(defaultStatus)
  const [priority, setPriority] = useState<TaskPriority>('medium')
  const [assignee, setAssignee] = useState<Assignee>('guilherme')
  const [dueDate, setDueDate] = useState('')
  const [selectedTags, setSelectedTags] = useState<TagId[]>([])
  const [recurrence, setRecurrence] = useState<Recurrence>('none')
  
  // Activity log state
  const [activities, setActivities] = useState<ActivityLog[]>([])
  const [activityOpen, setActivityOpen] = useState(false)
  const [loadingActivity, setLoadingActivity] = useState(false)

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
      setRecurrence(task.recurrence || 'none')
      
      // Load activity log
      setActivityOpen(false)
      setActivities([])
    } else {
      setTitle('')
      setDescription('')
      setStatus(defaultStatus)
      setPriority('medium')
      setAssignee('guilherme')
      setDueDate(defaultDueDate || '')
      setSelectedTags([])
      setRecurrence('none')
      setActivities([])
      setActivityOpen(false)
    }
  }, [task, defaultStatus, defaultDueDate, isOpen])

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

  // Load activity when expanded
  useEffect(() => {
    if (activityOpen && task && activities.length === 0) {
      setLoadingActivity(true)
      getTaskActivity(task.id).then(data => {
        setActivities(data)
        setLoadingActivity(false)
      })
    }
  }, [activityOpen, task, activities.length])

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
      recurrence,
    })
  }

  if (!isOpen) return null

  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: '42px',
    padding: '0 12px',
    fontSize: '16px',
    border: `1px solid ${isDark ? '#475569' : '#e5e7eb'}`,
    borderRadius: '8px',
    backgroundColor: isDark ? '#1e293b' : 'white',
    color: isDark ? '#f1f5f9' : '#374151',
    boxSizing: 'border-box',
    outline: 'none',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '13px',
    fontWeight: 500,
    color: isDark ? '#cbd5e1' : '#374151',
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
          backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.3)',
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
          backgroundColor: isDark ? '#1e293b' : 'white',
          borderRadius: '16px',
          boxShadow: isDark 
            ? '0 20px 40px rgba(0,0,0,0.4)' 
            : '0 20px 40px rgba(0,0,0,0.15)',
          display: 'grid',
          gridTemplateRows: 'auto 1fr auto',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ 
          padding: '16px 20px', 
          borderBottom: `1px solid ${isDark ? '#334155' : '#f3f4f6'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <h2 style={{ 
            fontSize: '17px', 
            fontWeight: 600, 
            margin: 0, 
            color: isDark ? '#f1f5f9' : '#111827' 
          }}>
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
            <X size={20} color={isDark ? '#94a3b8' : '#9ca3af'} />
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
                    const colorMap: Record<string, { bg: string; bgSelected: string; text: string; border: string }> = {
                      trabalho: { bg: isDark ? '#1e3a5f' : '#eff6ff', bgSelected: '#3b82f6', text: isDark ? '#93c5fd' : '#1d4ed8', border: isDark ? '#3b82f6' : '#93c5fd' },
                      pessoal: { bg: isDark ? '#14532d' : '#f0fdf4', bgSelected: '#22c55e', text: isDark ? '#86efac' : '#15803d', border: isDark ? '#22c55e' : '#86efac' },
                      urgente: { bg: isDark ? '#450a0a' : '#fef2f2', bgSelected: '#ef4444', text: isDark ? '#fca5a5' : '#b91c1c', border: isDark ? '#ef4444' : '#fca5a5' },
                      ideia: { bg: isDark ? '#3b0764' : '#faf5ff', bgSelected: '#a855f7', text: isDark ? '#d8b4fe' : '#7e22ce', border: isDark ? '#a855f7' : '#d8b4fe' },
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

              {/* Recurrence selector */}
              <div>
                <label style={labelStyle}>
                  <Repeat size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                  Repetição
                </label>
                <select
                  value={recurrence}
                  onChange={(e) => setRecurrence(e.target.value as Recurrence)}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                >
                  {RECURRENCES.map((r) => (
                    <option key={r.id} value={r.id}>{r.label}</option>
                  ))}
                </select>
              </div>

              {/* Activity Log Section - Only for existing tasks */}
              {isEditing && (
                <div style={{ 
                  marginTop: '8px', 
                  borderTop: `1px solid ${isDark ? '#334155' : '#f3f4f6'}`,
                  paddingTop: '14px' 
                }}>
                  <button
                    type="button"
                    onClick={() => setActivityOpen(!activityOpen)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      padding: '8px 0',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: isDark ? '#94a3b8' : '#6b7280',
                      fontSize: '13px',
                      fontWeight: 500,
                    }}
                  >
                    <span>📋 Histórico de Atividade</span>
                    {activityOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>

                  {activityOpen && (
                    <div style={{ 
                      marginTop: '8px',
                      maxHeight: '200px',
                      overflowY: 'auto',
                      backgroundColor: isDark ? '#0f172a' : '#f9fafb',
                      borderRadius: '8px',
                      padding: '12px',
                    }}>
                      {loadingActivity ? (
                        <p style={{ 
                          fontSize: '13px', 
                          color: isDark ? '#94a3b8' : '#9ca3af',
                          textAlign: 'center' 
                        }}>
                          A carregar...
                        </p>
                      ) : activities.length === 0 ? (
                        <p style={{ 
                          fontSize: '13px', 
                          color: isDark ? '#94a3b8' : '#9ca3af',
                          textAlign: 'center' 
                        }}>
                          Sem atividade registada
                        </p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {activities.map((activity) => (
                            <div 
                              key={activity.id}
                              style={{ 
                                display: 'flex',
                                gap: '8px',
                                alignItems: 'flex-start',
                              }}
                            >
                              <span style={{ fontSize: '14px' }}>
                                {getActivityIcon(activity.action)}
                              </span>
                              <div style={{ flex: 1 }}>
                                <p style={{ 
                                  fontSize: '13px',
                                  color: isDark ? '#e2e8f0' : '#374151',
                                  margin: 0,
                                  lineHeight: 1.4,
                                }}>
                                  {formatActivityMessage(activity)}
                                </p>
                                <p style={{
                                  fontSize: '11px',
                                  color: isDark ? '#64748b' : '#9ca3af',
                                  margin: '2px 0 0 0',
                                }}>
                                  {formatDistanceToNow(new Date(activity.created_at), { 
                                    addSuffix: true,
                                    locale: pt 
                                  })}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </form>
        </div>

        {/* Footer */}
        <div style={{ 
          padding: '14px 20px', 
          borderTop: `1px solid ${isDark ? '#334155' : '#f3f4f6'}`,
          backgroundColor: isDark ? '#0f172a' : '#fafafa',
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
                color: isDark ? '#94a3b8' : '#6b7280',
                backgroundColor: isDark ? '#1e293b' : 'white',
                border: `1px solid ${isDark ? '#475569' : '#e5e7eb'}`,
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
                backgroundColor: title.trim() ? '#4f46e5' : (isDark ? '#475569' : '#d1d5db'),
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
