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
import { Filter, Plus, RefreshCw, CheckCircle2, CalendarClock, Tag } from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'
import confetti from 'canvas-confetti'
import { supabase } from '@/lib/supabase'
import {
  Task,
  TaskStatus,
  Assignee,
  CreateTaskInput,
  COLUMNS,
  ASSIGNEES,
  TAGS,
  TagId,
} from '@/lib/types'
import Column from './Column'
import TaskCard from './TaskCard'
import TaskModal from './TaskModal'
import { isToday } from 'date-fns'

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

export default function Board() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [filterAssignee, setFilterAssignee] = useState<Assignee | 'all'>('all')
  const [filterTag, setFilterTag] = useState<TagId | 'all'>('all')

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [defaultColumnForNewTask, setDefaultColumnForNewTask] = useState<TaskStatus>('todo')

  // Drag state
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  
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
            setTasks((prev) =>
              prev.map((t) => (t.id === updatedTask.id ? updatedTask : t))
            )
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
  }

  // Handle drag over (moving between columns)
  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    // Find the active task
    const activeTaskData = tasks.find((t) => t.id === activeId)
    if (!activeTaskData) return

    // Check if we're over a column
    const isOverColumn = COLUMNS.some((col) => col.id === overId)
    if (isOverColumn) {
      const newStatus = overId as TaskStatus

      if (activeTaskData.status !== newStatus) {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === activeId ? { ...t, status: newStatus } : t
          )
        )
      }
      return
    }

    // We're over another task
    const overTask = tasks.find((t) => t.id === overId)
    if (!overTask) return

    if (activeTaskData.status !== overTask.status) {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === activeId ? { ...t, status: overTask.status } : t
        )
      )
    }
  }

  // Handle drag end
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveTask(null)

    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    const activeTaskData = tasks.find((t) => t.id === activeId)
    if (!activeTaskData) return
    
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
    } else if (targetStatus !== 'done' && activeTaskData.completed_at) {
      updates.completed_at = null
    }

    await supabase.from('tasks').update(updates).eq('id', activeId)
  }

  // Open modal to create new task
  const openNewTaskModal = (status: TaskStatus = 'todo') => {
    setEditingTask(null)
    setDefaultColumnForNewTask(status)
    setIsModalOpen(true)
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
  }

  // Quick add task (from column input)
  const handleQuickAdd = async (title: string, status: TaskStatus) => {
    const columnTasks = tasks.filter((t) => t.status === status)
    const maxPosition = columnTasks.length > 0
      ? Math.max(...columnTasks.map((t) => t.position))
      : -1

    const { error } = await supabase.from('tasks').insert({
      title,
      description: null,
      status,
      priority: 'medium',
      assignee: 'guilherme',
      due_date: null,
      tags: [],
      position: maxPosition + 1,
    })

    if (error) {
      console.error('Error creating task:', error)
      toast.error('Erro ao criar tarefa')
      return
    }
    toast.success('Tarefa criada!')
  }

  // Save task (create or update)
  const handleSaveTask = async (data: CreateTaskInput & { id?: string }) => {
    if (data.id) {
      // Get current task to check if status changed
      const currentTask = tasks.find((t) => t.id === data.id)
      const wasNotDone = currentTask?.status !== 'done'
      const isNowDone = data.status === 'done'
      
      // Update existing task
      const updateData: Partial<Task> & { updated_at: string } = {
        title: data.title,
        description: data.description || null,
        status: data.status,
        priority: data.priority,
        assignee: data.assignee,
        due_date: data.due_date || null,
        tags: data.tags || [],
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
      toast.success('Tarefa atualizada!')
    } else {
      // Create new task
      const columnTasks = tasks.filter((t) => t.status === data.status)
      const maxPosition = columnTasks.length > 0
        ? Math.max(...columnTasks.map((t) => t.position))
        : -1

      const { error } = await supabase.from('tasks').insert({
        title: data.title,
        description: data.description || null,
        status: data.status || 'todo',
        priority: data.priority || 'medium',
        assignee: data.assignee || 'guilherme',
        due_date: data.due_date || null,
        tags: data.tags || [],
        position: maxPosition + 1,
      })

      if (error) {
        console.error('Error creating task:', error)
        toast.error('Erro ao criar tarefa')
        return
      }
      toast.success('Tarefa criada!')
    }

    closeModal()
  }

  // Delete task
  const handleDeleteTask = async (id: string) => {
    const { error } = await supabase.from('tasks').delete().eq('id', id)

    if (error) {
      console.error('Error deleting task:', error)
      toast.error('Erro ao eliminar tarefa')
      return
    }

    toast.success('Tarefa eliminada!')
    closeModal()
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <Toaster 
        position="bottom-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#333',
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
      <header className="sticky top-0 z-40 bg-white border-b border-[var(--color-border)]">
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
              {/* Filter by tag */}
              <div className="flex items-center gap-2">
                <Tag size={16} className="text-[var(--color-text-muted)]" />
                <select
                  value={filterTag}
                  onChange={(e) => setFilterTag(e.target.value as TagId | 'all')}
                  className="
                    h-9 px-3 pr-8 rounded-md text-sm appearance-none
                    border border-[var(--color-border)] bg-white
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
                    border border-[var(--color-border)] bg-white
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

      {/* Board */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-[var(--color-text-muted)]">A carregar...</div>
          </div>
        ) : (
          <DndContext
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
        isOpen={isModalOpen}
        onClose={closeModal}
        onSave={handleSaveTask}
        onDelete={handleDeleteTask}
      />
    </div>
  )
}
