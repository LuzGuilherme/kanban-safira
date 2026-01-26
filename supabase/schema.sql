-- Kanban Safira - Database Schema
-- Execute this in Supabase SQL Editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Create tasks table
create table if not exists public.tasks (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  description text,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  assignee text not null default 'guilherme' check (assignee in ('guilherme', 'safira')),
  due_date date,
  tags text[] default '{}',
  position integer not null default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  completed_at timestamp with time zone
);

-- Create index for faster queries
create index if not exists tasks_status_idx on public.tasks(status);
create index if not exists tasks_assignee_idx on public.tasks(assignee);
create index if not exists tasks_position_idx on public.tasks(position);

-- Enable Row Level Security
alter table public.tasks enable row level security;

-- Create policy to allow all operations (for now - adjust for production)
create policy "Allow all operations" on public.tasks
  for all
  using (true)
  with check (true);

-- Enable realtime
alter publication supabase_realtime add table public.tasks;

-- Insert some sample tasks
insert into public.tasks (title, description, status, priority, assignee, position) values
  ('Configurar ambiente de desenvolvimento', 'Instalar dependências e configurar VS Code', 'done', 'high', 'guilherme', 0),
  ('Criar estrutura do Kanban', 'Implementar drag & drop e colunas', 'done', 'high', 'safira', 0),
  ('Integrar Supabase', 'Configurar base de dados e real-time', 'in_progress', 'high', 'safira', 0),
  ('Adicionar filtros avançados', 'Filtrar por prioridade e tags', 'todo', 'medium', 'guilherme', 0),
  ('Deploy na Vercel', 'Publicar a aplicação online', 'todo', 'medium', 'guilherme', 1);
