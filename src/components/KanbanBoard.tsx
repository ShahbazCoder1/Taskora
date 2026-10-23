'use client';

import React, { useState, useMemo, useRef } from 'react';
import { Task, TaskPriority, TaskStatus, TaskFilters } from '@/types';
import { TaskCard } from './TaskCard';
import { Search, Plus, X } from 'lucide-react';
import { getTodayKey } from '@/lib/storage';

interface KanbanBoardProps {
  tasks: Task[];
  onOpenNewTaskModal: (defaultStatus?: TaskStatus) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  onStartFocus: (task: Task) => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
}

export function KanbanBoard({
  tasks,
  onOpenNewTaskModal,
  onEditTask,
  onDeleteTask,
  onStatusChange,
  onStartFocus,
  onToggleSubtask,
}: KanbanBoardProps) {
  const [filters, setFilters] = useState<TaskFilters>({
    searchQuery: '',
    priority: 'all',
    tag: '',
    sortBy: 'order',
    sortDirection: 'asc',
  });

  const [activeDropColumn, setActiveDropColumn] = useState<TaskStatus | null>(null);
  const [mobileActiveColumn, setMobileActiveColumn] = useState<TaskStatus>('todo');

  const containerRef = useRef<HTMLDivElement>(null);
  const columnRefs = {
    todo: useRef<HTMLDivElement>(null),
    in_progress: useRef<HTMLDivElement>(null),
    done: useRef<HTMLDivElement>(null),
  };

  const scrollToColumn = (status: TaskStatus) => {
    setMobileActiveColumn(status);
    const target = columnRefs[status].current;
    if (target && containerRef.current) {
      target.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      });
    }
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (filters.searchQuery.trim()) {
        const q = filters.searchQuery.toLowerCase();
        const matchesTitle = task.title.toLowerCase().includes(q);
        const matchesDesc = task.description?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc) return false;
      }
      if (filters.priority !== 'all' && task.priority !== filters.priority) {
        return false;
      }
      return true;
    });
  }, [tasks, filters]);

  const columnsData = useMemo(() => {
    const todo = filteredTasks.filter((t) => t.status === 'todo');
    const inProgress = filteredTasks.filter((t) => t.status === 'in_progress');
    const done = filteredTasks.filter((t) => t.status === 'done');
    return { todo, in_progress: inProgress, done };
  }, [filteredTasks]);

  const handleDragOver = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (activeDropColumn !== status) setActiveDropColumn(status);
  };

  const handleDragLeave = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    if (activeDropColumn === status) setActiveDropColumn(null);
  };

  const handleDrop = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    setActiveDropColumn(null);
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId) onStatusChange(taskId, status);
  };

  const total = tasks.length;
  const completed = tasks.filter((t) => t.status === 'done').length;
  const overdue = tasks.filter(
    (t) => t.status !== 'done' && t.dueDate && t.dueDate < getTodayKey()
  ).length;

  const columns: { id: TaskStatus; title: string; count: number; tasks: Task[] }[] = [
    { id: 'todo', title: 'To Do', count: columnsData.todo.length, tasks: columnsData.todo },
    { id: 'in_progress', title: 'In Progress', count: columnsData.in_progress.length, tasks: columnsData.in_progress },
    { id: 'done', title: 'Done', count: columnsData.done.length, tasks: columnsData.done },
  ];

  const handleScroll = () => {
    if (!containerRef.current) return;
    const scrollLeft = containerRef.current.scrollLeft;
    const width = containerRef.current.offsetWidth;
    const index = Math.round(scrollLeft / width);
    if (index === 0 && mobileActiveColumn !== 'todo') setMobileActiveColumn('todo');
    else if (index === 1 && mobileActiveColumn !== 'in_progress') setMobileActiveColumn('in_progress');
    else if (index >= 2 && mobileActiveColumn !== 'done') setMobileActiveColumn('done');
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-5">
      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-4 border-b border-[#30363d]">
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={filters.searchQuery}
              onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
              className="w-full bg-[#161b22] border border-[#30363d] rounded-md pl-9 pr-8 py-1.5 text-sm text-slate-100 placeholder:text-slate-400 focus:border-slate-400 transition"
            />
            {filters.searchQuery && (
              <button
                onClick={() => setFilters({ ...filters, searchQuery: '' })}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-100"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Priority filter */}
          <div className="relative">
            <select
              value={filters.priority}
              onChange={(e) =>
                setFilters({ ...filters, priority: e.target.value as 'all' | TaskPriority })
              }
              className="bg-[#161b22] border border-[#30363d] rounded-md px-3 py-1.5 text-sm text-slate-200 focus:border-slate-400 transition cursor-pointer"
            >
              <option value="all">All Priorities</option>
              <option value="high">High Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="low">Low Priority</option>
            </select>
          </div>
        </div>

        {/* Quick summary stats */}
        <div className="flex items-center gap-3 text-sm text-slate-300 font-medium">
          <span>{total} tasks</span>
          <span className="text-slate-600">·</span>
          <span>{completed} completed</span>
          {overdue > 0 && (
            <>
              <span className="text-slate-600">·</span>
              <span className="text-rose-400 font-semibold">{overdue} overdue</span>
            </>
          )}
        </div>
      </div>

      {/* Mobile Horizontal Status Tracker Pills (Only on Mobile) */}
      <div className="md:hidden grid grid-cols-3 gap-1.5 p-1 rounded-lg bg-[#161b22] border border-[#30363d] text-xs">
        {columns.map((col) => {
          const isActive = mobileActiveColumn === col.id;
          return (
            <button
              key={col.id}
              onClick={() => scrollToColumn(col.id)}
              className={`whitespace-nowrap py-1.5 px-2 rounded-md font-semibold text-xs flex items-center justify-center gap-1 transition ${
                isActive
                  ? 'bg-[#21262d] text-white shadow-xs border border-[#30363d]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="whitespace-nowrap">{col.title}</span>
              <span className="text-[11px] font-mono opacity-80 shrink-0">({col.count})</span>
            </button>
          );
        })}
      </div>

      {/* Kanban Board Container: Horizontal Scroll on Mobile (< md), Grid on Desktop (md+) */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex md:grid md:grid-cols-3 gap-4 overflow-x-auto snap-x snap-mandatory md:overflow-visible pb-4 pt-1 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-none"
      >
        {columns.map((col) => {
          const isDropTarget = activeDropColumn === col.id;

          return (
            <div
              key={col.id}
              ref={columnRefs[col.id]}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDragLeave={(e) => handleDragLeave(e, col.id)}
              onDrop={(e) => handleDrop(e, col.id)}
              className={`w-[85vw] max-w-[340px] shrink-0 snap-center md:w-auto md:max-w-none md:shrink rounded-lg border bg-[#161b22] flex flex-col transition shadow-xs ${
                isDropTarget ? 'drag-target-active' : 'border-[#30363d]'
              }`}
            >
              {/* Header */}
              <div className="p-3.5 flex items-center justify-between border-b border-[#30363d] bg-[#1a202c]/40">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold tracking-tight text-white uppercase">
                    {col.title}
                  </h3>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#21262d] border border-[#30363d] text-slate-300">
                    {col.count}
                  </span>
                </div>

                <button
                  onClick={() => onOpenNewTaskModal(col.id)}
                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#21262d] transition"
                  title={`Add task to ${col.title}`}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Task list */}
              <div className="p-3 space-y-3 min-h-[400px] max-h-[calc(100vh-230px)] overflow-y-auto">
                {col.tasks.length === 0 ? (
                  <div className="h-40 flex flex-col items-center justify-center text-center p-4 text-slate-400 text-sm">
                    <p className="font-medium text-slate-300">No tasks in {col.title}</p>
                    <button
                      onClick={() => onOpenNewTaskModal(col.id)}
                      className="mt-2 text-slate-400 hover:text-white text-xs font-semibold border border-[#30363d] px-3 py-1 rounded bg-[#21262d] transition"
                    >
                      + Create Task
                    </button>
                  </div>
                ) : (
                  col.tasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onEdit={onEditTask}
                      onDelete={onDeleteTask}
                      onStatusChange={onStatusChange}
                      onStartFocus={onStartFocus}
                      onToggleSubtask={onToggleSubtask}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
