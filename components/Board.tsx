'use client'

import { useCallback, useEffect, useState, useRef } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { Filter, Plus, RefreshCw, CheckCircle2, CalendarClock, Tag, Sun, Moon, LayoutGrid, Calendar } from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'
import confetti from 'canvas-confetti'
import { addDays, addWeeks, addMonths } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/ThemeContext'
import { logActivity } from '@/lib/activity'
import {
  Task,
  TaskStatus,
  Assignee,
  CreateTaskInput,
  COLUMNS,
  ASSIGNEES,
  TAGS,
  TagId,
  Recurrence,
} from '@/lib/types'
import Column from './Column'
import TaskCard from './TaskCard'
import TaskModal from './TaskModal'
import CalendarView from './CalendarView'
import { isToday, format } from 'date-fns'

// View types
type ViewMode = 'kanban' | 'calendar'

// Current user name - in a real app, this would come from auth
const CURRENT_USER = 'Guilherme'

// Fire confetti celebration
const fireConfetti = () => {
  const count = 200
  const defaults = {
    origin: { y: 0.7 },
    zIndex: 9999,
  }

  function fire(particleRatio: number, opts: confetti.Options) {
    confetti({
      ...defaults,
      ...opts,
      particleCount: Math.floor(count * particleRatio),
    })
  }

  fire(0.25, {
    spread: 26,
    startVelocity: 55,
  })
  fire(0.2, {
    spread: 60,
  })
  fire(0.35, {
    spread: 100,
    decay: 0.91,
    scalar: 0.8,
  })
  fire(0.1, {
    spread: 120,
    startVelocity: 25,
    decay: 0.92,
    scalar: 1.2,
  })
  fire(0.1, {
    spread: 120,
    startVelocity: 45,
  })
}

// Calculate next due date based on recurrence
function getNextDueDate(currentDueDate: string, recurrence: Recurrence): string {
  const date = new Date(currentDueDate)
  switch (recurrence) {
    case 'daily':
      return addDays(date, 1).toISOString().split('T')[0]
    case 'weekly':
      return addWeeks(date, 1).toISOString().split('T')[0]
    case 'monthly':
      return addMonths(date, 1).toISOString().split('T')[0]
    default:
      return currentDueDate
  }
}

export default function Board() {
  const { theme, toggleTheme } = useTheme()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [filterAssignee, setFilterAssignee] = useState<Assignee | 'all'>('all')
  const [filterTag, setFilterTag] = useState<TagId | 'all'>('all')
  
  // View mode state
  const [viewMode, setViewMode] = useState<ViewMode>('kanban')

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [defaultColumnForNewTask, setDefaultColumnForNewTask] = useState<TaskStatus>('todo')
  const [defaultDueDate, setDefaultDueDate] = useState<string | undefined>(undefined)

  // Drag state
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dndKey, setDndKey] = useState(0)
  
  // Track previous status for confetti trigger
  const previousStatusRef = useRef<Map<string, TaskStatus>>(new Map())

  // Configure drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  // Fetch tasks from Supabase
  const fetchTasks = useCallback(async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('position', { ascending: true })

    if (error) {
      console.error('Error fetching tasks:', error)
      return
    }

    const fetchedTasks = data || []
    
    // Initialize previous status tracking
    fetchedTasks.forEach((task) => {
      previousStatusRef.current.set(task.id, task.status)
    })
    
    setTasks(fetchedTasks)
    setLoading(false)
  }, [])

  // Load view preference from localStorage
  useEffect(() => {
    const savedView = localStorage.getItem('kanban-view-mode') as ViewMode | null
    if (savedView === 'kanban' || savedView === 'calendar') {
      setViewMode(savedView)
    }
  }, [])

  // Toggle view mode
  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode)
    localStorage.setItem('kanban-view-mode', mode)
  }

  // Initial fetch and real-time subscription
  useEffect(() => {
    fetchTasks()

    // Subscribe to real-time changes
    const channel = supabase
      .channel('tasks-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newTask = payload.new as Task
            previousStatusRef.current.set(newTask.id, newTask.status)
            setTasks((prev) => [...prev, newTask])
          } else if (payload.eventType === 'UPDATE') {
            const updatedTask = payload.new as Task
            const prevStatus = previousStatusRef.current.get(updatedTask.id)
            
            // Fire confetti if task was moved to done
            if (prevStatus !== 'done' && updatedTask.status === 'done') {
              fireConfetti()
            }
            
            previousStatusRef.current.set(updatedTask.id, updatedTask.status)
            
            // Use functional update to ensure we have latest state
            setTasks((prev) => {
              // Check if task already has the same updated_at (already applied locally)
              const existingTask = prev.find(t => t.id === updatedTask.id)
              if (existingTask && existingTask.updated_at === updatedTask.updated_at) {
                // Skip update if already applied (same timestamp)
                return prev
              }
              return prev.map((t) => (t.id === updatedTask.id ? updatedTask : t))
            })
          } else if (payload.eventType === 'DELETE') {
            previousStatusRef.current.delete(payload.old.id)
            setTasks((prev) => prev.filter((t) => t.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchTasks])

  // Filter tasks by assignee and tag
  const filteredTasks = tasks.filter((t) => {
    const matchesAssignee = filterAssignee === 'all' || t.assignee === filterAssignee
    const matchesTag = filterTag === 'all' || (t.tags && t.tags.includes(filterTag))
    return matchesAssignee && matchesTag
  })

  // Group tasks by status
  const tasksByStatus = COLUMNS.reduce(
    (acc, col) => ({
      ...acc,
      [col.id]: filteredTasks
        .filter((t) => t.status === col.id)
        .sort((a, b) => a.position - b.position),
    }),
    {} as Record<TaskStatus, Task[]>
  )

  // Calculate task statistics
  const totalTasks = filteredTasks.length
  const completedTasks = filteredTasks.filter((t) => t.status === 'done').length
  const dueTodayTasks = filteredTasks.filter(
    (t) => t.due_date && isToday(new Date(t.due_date)) && t.status !== 'done'
  ).length

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id)
    setActiveTask(task || null)
    setIsDragging(true)
  }

  // Handle drag over (moving between columns)
  // NOTE: We intentionally don't update state here to avoid breaking dnd-kit.
  // The DragOverlay provides visual feedback. State is updated only in handleDragEnd.
  const handleDragOver = (event: DragOverEvent) => {
    // Intentionally empty - visual feedback is provided by DragOverlay
    // and drop zones are highlighted by useDroppable's isOver state
  }

  // Handle drag end
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveTask(null)
    setIsDragging(false)

    if (!over) {
      // Force DndContext reset even when dropped outside
      setDndKey(prev => prev + 1)
      return
    }

    const activeId = active.id as string
    const overId = over.id as string

    const activeTaskData = tasks.find((t) => t.id === activeId)
    if (!activeTaskData) {
      setDndKey(prev => prev + 1)
      return
    }
    
    // Get the original status before the drag
    const originalStatus = previousStatusRef.current.get(activeId)

    // Determine target status
    let targetStatus: TaskStatus = activeTaskData.status
    const isOverColumn = COLUMNS.some((col) => col.id === overId)

    if (isOverColumn) {
      targetStatus = overId as TaskStatus
    } else {
      const overTask = tasks.find((t) => t.id === overId)
      if (overTask) {
        targetStatus = overTask.status
      }
    }

    // Optimistic update: immediately move card to target column for visual feedback
    if (activeTaskData.status !== targetStatus) {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === activeId ? { ...t, status: targetStatus } : t
        )
      )
    }

    // Get tasks in target column
    const columnTasks = tasks
      .filter((t) => t.status === targetStatus)
      .sort((a, b) => a.position - b.position)

    // Calculate new position
    let newPosition: number

    if (isOverColumn) {
      // Dropped on column - add to end
      newPosition = columnTasks.length > 0
        ? Math.max(...columnTasks.map((t) => t.position)) + 1
        : 0
    } else {
      // Dropped on another task - insert before/after
      const overIndex = columnTasks.findIndex((t) => t.id === overId)
      const activeIndex = columnTasks.findIndex((t) => t.id === activeId)

      if (activeIndex !== -1 && activeIndex !== overIndex) {
        // Reordering within same column
        const newOrder = arrayMove(columnTasks, activeIndex, overIndex)
        newPosition = overIndex

        // Update positions for all affected tasks
        const updates = newOrder.map((task, idx) => ({
          id: task.id,
          position: idx,
        }))

        for (const update of updates) {
          await supabase
            .from('tasks')
            .update({ position: update.position })
            .eq('id', update.id)
        }
        
        // Force DndContext reset after reordering
        setDndKey(prev => prev + 1)
        return
      } else {
        // Moving to different column
        newPosition = overIndex >= 0 ? overIndex : columnTasks.length
      }
    }

    // Update in Supabase
    const updates: Partial<Task> = {
      status: targetStatus,
      position: newPosition,
      updated_at: new Date().toISOString(),
    }

    // If moving to done, set completed_at
    if (targetStatus === 'done' && originalStatus !== 'done') {
      updates.completed_at = new Date().toISOString()
      
      // Log completed activity
      await logActivity(activeId, 'completed', CURRENT_USER)
      
      // Handle recurring tasks
      if (activeTaskData.recurrence && activeTaskData.recurrence !== 'none' && activeTaskData.due_date) {
        const nextDueDate = getNextDueDate(activeTaskData.due_date, activeTaskData.recurrence)
        const todoTasks = tasks.filter(t => t.status === 'todo')
        const maxPosition = todoTasks.length > 0 
          ? Math.max(...todoTasks.map(t => t.position)) 
          : -1

        // Create next recurring task
        const { data: newTask, error: createError } = await supabase
          .from('tasks')
          .insert({
            title: activeTaskData.title,
            description: activeTaskData.description,
            status: 'todo',
            priority: activeTaskData.priority,
            assignee: activeTaskData.assignee,
            due_date: nextDueDate,
            tags: activeTaskData.tags,
            recurrence: activeTaskData.recurrence,
            position: maxPosition + 1,
          })
          .select()
          .single()

        if (!createError && newTask) {
          await logActivity(newTask.id, 'created', CURRENT_USER, { 
            recurring: true, 
            from_task: activeTaskData.id 
          })
          toast.success(`Tarefa recorrente criada para ${nextDueDate}`)
        }
      }
    } else if (targetStatus !== 'done' && activeTaskData.completed_at) {
      updates.completed_at = null
    }
    
    // Log move activity if status changed
    if (originalStatus && originalStatus !== targetStatus) {
      await logActivity(activeId, 'moved', CURRENT_USER, {
        from: originalStatus,
        to: targetStatus,
      })
    }

    await supabase.from('tasks').update(updates).eq('id', activeId)
    
    // Force DndContext reset after drag completes
    setDndKey(prev => prev + 1)
  }

  // Open modal to create new task
  const openNewTaskModal = (status: TaskStatus = 'todo', dueDate?: string) => {
    setEditingTask(null)
    setDefaultColumnForNewTask(status)
    setDefaultDueDate(dueDate)
    setIsModalOpen(true)
  }

  // Handle calendar day click to create task with that date
  const handleCalendarDayClick = (date: Date) => {
    const formattedDate = format(date, 'yyyy-MM-dd')
    openNewTaskModal('todo', formattedDate)
  }

  // Open modal to edit existing task
  const openEditTaskModal = (task: Task) => {
    setEditingTask(task)
    setIsModalOpen(true)
  }

  // Close modal
  const closeModal = () => {
    setIsModalOpen(false)
    setEditingTask(null)
    setDefaultDueDate(undefined)
  }

  // Quick add task (from column input)
  const handleQuickAdd = async (title: string, status: TaskStatus) => {
    const columnTasks = tasks.filter((t) => t.status === status)
    const maxPosition = columnTasks.length > 0
      ? Math.max(...columnTasks.map((t) => t.position))
      : -1

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        title,
        description: null,
        status,
        priority: 'medium',
        assignee: 'guilherme',
        due_date: null,
        tags: [],
        recurrence: 'none',
        position: maxPosition + 1,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating task:', error)
      toast.error('Erro ao criar tarefa')
      return
    }
    
    // Log activity
    if (data) {
      await logActivity(data.id, 'created', CURRENT_USER)
    }
    
    toast.success('Tarefa criada!')
  }

  // Save task (create or update)
  const handleSaveTask = async (data: CreateTaskInput & { id?: string }) => {
    if (data.id) {
      // Get current task to check changes
      const currentTask = tasks.find((t) => t.id === data.id)
      const wasNotDone = currentTask?.status !== 'done'
      const isNowDone = data.status === 'done'
      
      // Track what changed
      const changes: string[] = []
      if (currentTask?.title !== data.title) changes.push('título')
      if (currentTask?.description !== (data.description || null)) changes.push('descrição')
      if (currentTask?.priority !== data.priority) changes.push('prioridade')
      if (currentTask?.assignee !== data.assignee) changes.push('responsável')
      if (currentTask?.due_date !== (data.due_date || null)) changes.push('data limite')
      if (currentTask?.recurrence !== (data.recurrence || 'none')) changes.push('repetição')
      if (JSON.stringify(currentTask?.tags || []) !== JSON.stringify(data.tags || [])) changes.push('etiquetas')
      
      // Update existing task
      const updateData: Partial<Task> & { updated_at: string } = {
        title: data.title,
        description: data.description || null,
        status: data.status,
        priority: data.priority,
        assignee: data.assignee,
        due_date: data.due_date || null,
        tags: data.tags || [],
        recurrence: data.recurrence || 'none',
        updated_at: new Date().toISOString(),
      }
      
      // Set completed_at if moving to done
      if (wasNotDone && isNowDone) {
        updateData.completed_at = new Date().toISOString()
      } else if (!isNowDone) {
        updateData.completed_at = null
      }
      
      const { error } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', data.id)

      if (error) {
        console.error('Error updating task:', error)
        toast.error('Erro ao atualizar tarefa')
        return
      }
      
      // Log activity
      if (wasNotDone && isNowDone) {
        await logActivity(data.id, 'completed', CURRENT_USER)
        
        // Handle recurring tasks
        if (currentTask && currentTask.recurrence && currentTask.recurrence !== 'none' && currentTask.due_date) {
          const nextDueDate = getNextDueDate(currentTask.due_date, currentTask.recurrence)
          const todoTasks = tasks.filter(t => t.status === 'todo')
          const maxPosition = todoTasks.length > 0 
            ? Math.max(...todoTasks.map(t => t.position)) 
            : -1

          // Create next recurring task
          const { data: newTask, error: createError } = await supabase
            .from('tasks')
            .insert({
              title: currentTask.title,
              description: currentTask.description,
              status: 'todo',
              priority: currentTask.priority,
              assignee: currentTask.assignee,
              due_date: nextDueDate,
              tags: currentTask.tags,
              recurrence: currentTask.recurrence,
              position: maxPosition + 1,
            })
            .select()
            .single()

          if (!createError && newTask) {
            await logActivity(newTask.id, 'created', CURRENT_USER, { 
              recurring: true, 
              from_task: currentTask.id 
            })
            toast.success(`Tarefa recorrente criada para ${nextDueDate}`)
          }
        }
      } else if (currentTask?.status !== data.status) {
        await logActivity(data.id, 'moved', CURRENT_USER, {
          from: currentTask?.status,
          to: data.status,
        })
      } else if (changes.length > 0) {
        await logActivity(data.id, 'updated', CURRENT_USER, { changes })
      }
      
      // Optimistic update - update local state immediately
      setTasks((prev) =>
        prev.map((t) =>
          t.id === data.id
            ? {
                ...t,
                ...updateData,
              }
            : t
        )
      )
      
      toast.success('Tarefa atualizada!')
    } else {
      // Create new task
      const columnTasks = tasks.filter((t) => t.status === data.status)
      const maxPosition = columnTasks.length > 0
        ? Math.max(...columnTasks.map((t) => t.position))
        : -1

      const { data: newTask, error } = await supabase
        .from('tasks')
        .insert({
          title: data.title,
          description: data.description || null,
          status: data.status || 'todo',
          priority: data.priority || 'medium',
          assignee: data.assignee || 'guilherme',
          due_date: data.due_date || null,
          tags: data.tags || [],
          recurrence: data.recurrence || 'none',
          position: maxPosition + 1,
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating task:', error)
        toast.error('Erro ao criar tarefa')
        return
      }
      
      // Log activity
      if (newTask) {
        await logActivity(newTask.id, 'created', CURRENT_USER)
      }
      
      toast.success('Tarefa criada!')
    }

    closeModal()
  }

  // Delete task
  const handleDeleteTask = async (id: string, fromModal: boolean = true) => {
    // Log activity before delete
    await logActivity(id, 'deleted', CURRENT_USER)
    
    // Optimistic update - remove from local state immediately
    setTasks((prev) => prev.filter((t) => t.id !== id))
    
    const { error } = await supabase.from('tasks').delete().eq('id', id)

    if (error) {
      console.error('Error deleting task:', error)
      toast.error('Erro ao eliminar tarefa')
      // Refetch to restore state if delete failed
      fetchTasks()
      return
    }

    toast.success('Tarefa eliminada!')
    if (fromModal) {
      closeModal()
    }
  }
  
  // Quick delete handler for task cards
  const handleQuickDelete = async (id: string) => {
    await handleDeleteTask(id, false)
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <Toaster 
        position="bottom-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: theme === 'dark' ? '#1e293b' : '#333',
            color: '#fff',
            borderRadius: '8px',
          },
          success: {
            iconTheme: {
              primary: '#6366f1',
              secondary: '#fff',
            },
          },
        }}
      />
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[var(--color-surface)] border-b border-[var(--color-border)]">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Title and stats */}
            <div>
              <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">
                Quadro Kanban
              </h1>
              <div className="flex items-center gap-4 mt-1">
                <p className="text-sm text-[var(--color-text-muted)]">
                  Guilherme & Safira
                </p>
                <div className="flex items-center gap-3 text-sm">
                  <span className="flex items-center gap-1.5 text-[var(--color-text-muted)]">
                    <CheckCircle2 size={14} className="text-green-500" />
                    {completedTasks}/{totalTasks} tarefas
                  </span>
                  {dueTodayTasks > 0 && (
                    <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                      <CalendarClock size={14} />
                      {dueTodayTasks} para hoje
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              {/* View Toggle */}
              <div className="flex items-center bg-[var(--color-bg)] rounded-lg p-1 border border-[var(--color-border)]">
                <button
                  onClick={() => handleViewModeChange('kanban')}
                  className={`
                    flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium
                    transition-all duration-150
                    ${viewMode === 'kanban'
                      ? 'bg-[var(--color-accent)] text-white shadow-sm'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                    }
                  `}
                >
                  <LayoutGrid size={16} />
                  <span className="hidden sm:inline">Kanban</span>
                </button>
                <button
                  onClick={() => handleViewModeChange('calendar')}
                  className={`
                    flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium
                    transition-all duration-150
                    ${viewMode === 'calendar'
                      ? 'bg-[var(--color-accent)] text-white shadow-sm'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                    }
                  `}
                >
                  <Calendar size={16} />
                  <span className="hidden sm:inline">Calendário</span>
                </button>
              </div>

              {/* Filter by tag */}
              <div className="flex items-center gap-2">
                <Tag size={16} className="text-[var(--color-text-muted)]" />
                <select
                  value={filterTag}
                  onChange={(e) => setFilterTag(e.target.value as TagId | 'all')}
                  className="
                    h-9 px-3 pr-8 rounded-md text-sm appearance-none
                    border border-[var(--color-border)] bg-[var(--color-surface)]
                    text-[var(--color-text-primary)]
                    hover:border-[var(--color-border-hover)]
                    focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]
                    transition-colors duration-150
                    cursor-pointer
                  "
                >
                  <option value="all">Todas etiquetas</option>
                  {TAGS.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filter by assignee */}
              <div className="flex items-center gap-2">
                <Filter size={16} className="text-[var(--color-text-muted)]" />
                <select
                  value={filterAssignee}
                  onChange={(e) => setFilterAssignee(e.target.value as Assignee | 'all')}
                  className="
                    h-9 px-3 pr-8 rounded-md text-sm appearance-none
                    border border-[var(--color-border)] bg-[var(--color-surface)]
                    text-[var(--color-text-primary)]
                    hover:border-[var(--color-border-hover)]
                    focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]
                    transition-colors duration-150
                    cursor-pointer
                  "
                >
                  <option value="all">Todos</option>
                  {ASSIGNEES.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Dark mode toggle */}
              <button
                onClick={toggleTheme}
                className="
                  p-2 rounded-md text-[var(--color-text-muted)]
                  hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-secondary)]
                  transition-colors duration-150
                "
                aria-label={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
                title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
              >
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </button>

              {/* Refresh button */}
              <button
                onClick={fetchTasks}
                className="
                  p-2 rounded-md text-[var(--color-text-muted)]
                  hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-secondary)]
                  transition-colors duration-150
                "
                aria-label="Atualizar"
              >
                <RefreshCw size={18} />
              </button>

              {/* Add task button */}
              <button
                onClick={() => openNewTaskModal()}
                className="
                  flex items-center gap-2 h-9 px-4 rounded-md
                  text-sm font-medium text-white
                  bg-[var(--color-accent)]
                  hover:bg-[var(--color-accent-hover)]
                  transition-colors duration-150
                "
              >
                <Plus size={16} />
                Nova Tarefa
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-[var(--color-text-muted)]">A carregar...</div>
          </div>
        ) : viewMode === 'calendar' ? (
          /* Calendar View */
          <CalendarView
            tasks={filteredTasks}
            onTaskClick={openEditTaskModal}
            onDayClick={handleCalendarDayClick}
          />
        ) : (
          /* Kanban Board View */
          <DndContext
            key={dndKey}
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-6 overflow-x-auto pb-4">
              {COLUMNS.map((column) => (
                <Column
                  key={column.id}
                  id={column.id}
                  title={column.title}
                  tasks={tasksByStatus[column.id]}
                  onTaskClick={openEditTaskModal}
                  onTaskDelete={handleQuickDelete}
                  onAddTask={() => openNewTaskModal(column.id)}
                  onQuickAdd={(title) => handleQuickAdd(title, column.id)}
                />
              ))}
            </div>

            {/* Drag overlay for smooth dragging */}
            <DragOverlay>
              {activeTask && (
                <TaskCard
                  task={activeTask}
                  onClick={() => {}}
                  isDragging
                />
              )}
            </DragOverlay>
          </DndContext>
        )}
      </main>

      {/* Task Modal */}
      <TaskModal
        task={editingTask}
        defaultStatus={defaultColumnForNewTask}
        defaultDueDate={defaultDueDate}
        isOpen={isModalOpen}
        onClose={closeModal}
        onSave={handleSaveTask}
        onDelete={handleDeleteTask}
      />
    </div>
  )
}
