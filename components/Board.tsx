'use client'

import { useCallback, useEffect, useState } from 'react'
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
import { Filter, Plus, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  Task,
  TaskStatus,
  Assignee,
  CreateTaskInput,
  COLUMNS,
  ASSIGNEES,
} from '@/lib/types'
import Column from './Column'
import TaskCard from './TaskCard'
import TaskModal from './TaskModal'

export default function Board() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [filterAssignee, setFilterAssignee] = useState<Assignee | 'all'>('all')

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [defaultColumnForNewTask, setDefaultColumnForNewTask] = useState<TaskStatus>('todo')

  // Drag state
  const [activeTask, setActiveTask] = useState<Task | null>(null)

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

    setTasks(data || [])
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
            setTasks((prev) => [...prev, payload.new as Task])
          } else if (payload.eventType === 'UPDATE') {
            setTasks((prev) =>
              prev.map((t) => (t.id === payload.new.id ? (payload.new as Task) : t))
            )
          } else if (payload.eventType === 'DELETE') {
            setTasks((prev) => prev.filter((t) => t.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchTasks])

  // Filter tasks by assignee
  const filteredTasks = filterAssignee === 'all'
    ? tasks
    : tasks.filter((t) => t.assignee === filterAssignee)

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
    if (targetStatus === 'done' && activeTaskData.status !== 'done') {
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

  // Save task (create or update)
  const handleSaveTask = async (data: CreateTaskInput & { id?: string }) => {
    if (data.id) {
      // Update existing task
      const { error } = await supabase
        .from('tasks')
        .update({
          title: data.title,
          description: data.description || null,
          status: data.status,
          priority: data.priority,
          assignee: data.assignee,
          due_date: data.due_date || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', data.id)

      if (error) {
        console.error('Error updating task:', error)
        return
      }
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
        position: maxPosition + 1,
      })

      if (error) {
        console.error('Error creating task:', error)
        return
      }
    }

    closeModal()
  }

  // Delete task
  const handleDeleteTask = async (id: string) => {
    const { error } = await supabase.from('tasks').delete().eq('id', id)

    if (error) {
      console.error('Error deleting task:', error)
      return
    }

    closeModal()
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-[var(--color-border)]">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Title */}
            <div>
              <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">
                Quadro Kanban
              </h1>
              <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
                Guilherme & Safira
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
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
