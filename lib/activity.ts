import { supabase } from './supabase'
import { ActivityLog, ActivityAction } from './types'

export async function logActivity(
  taskId: string,
  action: ActivityAction,
  userName: string,
  details?: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase.from('activity_log').insert({
    task_id: taskId,
    action,
    user_name: userName,
    details: details || null,
  })

  if (error) {
    console.error('Error logging activity:', error)
  }
}

export async function getTaskActivity(taskId: string): Promise<ActivityLog[]> {
  const { data, error } = await supabase
    .from('activity_log')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('Error fetching activity:', error)
    return []
  }

  return data || []
}

// Helper to format activity message in Portuguese
export function formatActivityMessage(activity: ActivityLog): string {
  const { action, user_name, details } = activity
  
  switch (action) {
    case 'created':
      return `${user_name} criou esta tarefa`
    case 'updated':
      if (details?.changes) {
        const changes = details.changes as string[]
        return `${user_name} editou: ${changes.join(', ')}`
      }
      return `${user_name} editou esta tarefa`
    case 'moved':
      if (details?.from && details?.to) {
        const statusLabels: Record<string, string> = {
          todo: 'A Fazer',
          in_progress: 'Em Progresso',
          done: 'Concluído',
        }
        return `${user_name} moveu de "${statusLabels[details.from as string]}" para "${statusLabels[details.to as string]}"`
      }
      return `${user_name} moveu esta tarefa`
    case 'completed':
      return `${user_name} concluiu esta tarefa 🎉`
    case 'deleted':
      return `${user_name} eliminou esta tarefa`
    default:
      return `${user_name} fez uma ação`
  }
}

// Helper to get action icon
export function getActivityIcon(action: ActivityAction): string {
  switch (action) {
    case 'created':
      return '✨'
    case 'updated':
      return '✏️'
    case 'moved':
      return '↔️'
    case 'completed':
      return '✅'
    case 'deleted':
      return '🗑️'
    default:
      return '•'
  }
}
