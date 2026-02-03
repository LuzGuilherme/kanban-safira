'use client'

import { useMemo, useState } from 'react'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
} from 'date-fns'
import { pt } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react'
import { Task, TaskPriority } from '@/lib/types'

interface CalendarViewProps {
  tasks: Task[]
  onTaskClick: (task: Task) => void
  onDayClick: (date: Date) => void
}

// Priority colors for task pills
const priorityColors: Record<TaskPriority, { bg: string; darkBg: string }> = {
  high: { bg: 'bg-red-500', darkBg: 'bg-red-600' },
  medium: { bg: 'bg-amber-500', darkBg: 'bg-amber-600' },
  low: { bg: 'bg-green-500', darkBg: 'bg-green-600' },
}

// Week days header
const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

export default function CalendarView({ tasks, onTaskClick, onDayClick }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())

  // Calculate calendar days
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 }) // Monday start
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

    return eachDayOfInterval({ start: calendarStart, end: calendarEnd })
  }, [currentMonth])

  // Group tasks by date
  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>()
    tasks.forEach((task) => {
      if (task.due_date) {
        const dateKey = task.due_date.split('T')[0]
        const existing = map.get(dateKey) || []
        existing.push(task)
        map.set(dateKey, existing)
      }
    })
    return map
  }, [tasks])

  const navigateToPreviousMonth = () => setCurrentMonth((prev) => subMonths(prev, 1))
  const navigateToNextMonth = () => setCurrentMonth((prev) => addMonths(prev, 1))
  const navigateToToday = () => setCurrentMonth(new Date())

  const handleDayClick = (day: Date, dayTasks: Task[]) => {
    if (dayTasks.length === 0) {
      onDayClick(day)
    }
  }

  return (
    <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] overflow-hidden">
      {/* Calendar Header */}
      <div className="p-4 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)] capitalize">
              {format(currentMonth, 'MMMM yyyy', { locale: pt })}
            </h2>
            <button
              onClick={navigateToToday}
              className="
                px-3 py-1.5 text-sm font-medium rounded-md
                text-[var(--color-text-secondary)]
                hover:bg-[var(--color-bg)] hover:text-[var(--color-text-primary)]
                transition-colors duration-150
              "
            >
              Hoje
            </button>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={navigateToPreviousMonth}
              className="
                p-2 rounded-md text-[var(--color-text-muted)]
                hover:bg-[var(--color-bg)] hover:text-[var(--color-text-primary)]
                transition-colors duration-150
              "
              aria-label="Mês anterior"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={navigateToNextMonth}
              className="
                p-2 rounded-md text-[var(--color-text-muted)]
                hover:bg-[var(--color-bg)] hover:text-[var(--color-text-primary)]
                transition-colors duration-150
              "
              aria-label="Próximo mês"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Weekday Headers */}
      <div className="grid grid-cols-7 border-b border-[var(--color-border)]">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="
              px-2 py-3 text-center text-xs font-semibold uppercase tracking-wide
              text-[var(--color-text-muted)]
              bg-[var(--color-bg-secondary)]
            "
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7">
        {calendarDays.map((day, index) => {
          const dateKey = format(day, 'yyyy-MM-dd')
          const dayTasks = tasksByDate.get(dateKey) || []
          const isCurrentMonth = isSameMonth(day, currentMonth)
          const isDayToday = isToday(day)
          const hasTasks = dayTasks.length > 0

          // Sort tasks by priority (high -> medium -> low)
          const sortedTasks = [...dayTasks].sort((a, b) => {
            const priorityOrder = { high: 0, medium: 1, low: 2 }
            return priorityOrder[a.priority] - priorityOrder[b.priority]
          })

          return (
            <div
              key={index}
              onClick={() => handleDayClick(day, dayTasks)}
              className={`
                min-h-[100px] md:min-h-[120px] p-1.5 border-b border-r border-[var(--color-border)]
                transition-colors duration-150
                ${isCurrentMonth ? 'bg-[var(--color-surface)]' : 'bg-[var(--color-bg-secondary)] opacity-50'}
                ${!hasTasks && isCurrentMonth ? 'cursor-pointer hover:bg-[var(--color-bg)]' : ''}
                ${index % 7 === 6 ? 'border-r-0' : ''}
              `}
            >
              {/* Day Number */}
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`
                    inline-flex items-center justify-center w-7 h-7 text-sm font-medium rounded-full
                    ${isDayToday 
                      ? 'bg-[var(--color-accent)] text-white' 
                      : isCurrentMonth 
                        ? 'text-[var(--color-text-primary)]' 
                        : 'text-[var(--color-text-muted)]'
                    }
                  `}
                >
                  {format(day, 'd')}
                </span>
                {hasTasks && !isDayToday && (
                  <span className="w-2 h-2 rounded-full bg-[var(--color-accent)] opacity-50" />
                )}
              </div>

              {/* Task Pills */}
              <div className="space-y-1 overflow-hidden">
                {sortedTasks.slice(0, 3).map((task) => (
                  <button
                    key={task.id}
                    onClick={(e) => {
                      e.stopPropagation()
                      onTaskClick(task)
                    }}
                    className={`
                      w-full text-left px-2 py-1 rounded text-[11px] font-medium
                      text-white truncate
                      transition-opacity duration-150
                      hover:opacity-80
                      ${priorityColors[task.priority].bg}
                      ${task.status === 'done' ? 'opacity-50 line-through' : ''}
                    `}
                    title={task.title}
                  >
                    {task.title}
                  </button>
                ))}
                {sortedTasks.length > 3 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      // Show first task of the overflow
                      onTaskClick(sortedTasks[3])
                    }}
                    className="
                      w-full text-left px-2 py-0.5 rounded text-[10px] font-medium
                      text-[var(--color-text-muted)]
                      bg-[var(--color-bg-secondary)]
                      hover:bg-[var(--color-bg)]
                      transition-colors duration-150
                    "
                  >
                    +{sortedTasks.length - 3} mais
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="p-3 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
        <div className="flex items-center justify-center gap-6 text-xs text-[var(--color-text-muted)]">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-red-500" />
            <span>Alta</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-amber-500" />
            <span>Média</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-green-500" />
            <span>Baixa</span>
          </div>
        </div>
      </div>
    </div>
  )
}
