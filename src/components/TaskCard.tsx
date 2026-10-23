'use client';

import React from 'react';
import { Task, TaskPriority, TaskStatus } from '@/types';
import { 
  Calendar, 
  Clock, 
  CheckCircle2, 
  Circle, 
  Timer, 
  Pencil, 
  Trash2, 
  ChevronRight, 
  ChevronLeft 
} from 'lucide-react';
import { getTodayKey } from '@/lib/storage';

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  onStartFocus: (task: Task) => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
}

export function TaskCard({
  task,
  onEdit,
  onDelete,
  onStatusChange,
  onStartFocus,
  onToggleSubtask,
}: TaskCardProps) {
  const todayKey = getTodayKey();
  const isDone = task.status === 'done';
  const isOverdue = !isDone && task.dueDate && task.dueDate < todayKey;
  const isDueToday = !isDone && task.dueDate === todayKey;

  const totalSubtasks = task.subtasks?.length || 0;
  const completedSubtasks = task.subtasks?.filter((s) => s.completed).length || 0;

  const priorityMeta: Record<TaskPriority, { label: string; dot: string; text: string }> = {
    high: { label: 'High', dot: 'bg-rose-500', text: 'text-rose-300' },
    medium: { label: 'Medium', dot: 'bg-amber-400', text: 'text-amber-300' },
    low: { label: 'Low', dot: 'bg-slate-400', text: 'text-slate-300' },
  };

  const currentPriority = priorityMeta[task.priority] || priorityMeta.low;

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className={`group relative rounded-lg border p-3.5 transition bg-[#21262d] cursor-grab active:cursor-grabbing shadow-xs ${
        isDone
          ? 'border-[#30363d] opacity-60'
          : isOverdue
          ? 'border-rose-800/80 hover:border-rose-600'
          : 'border-[#30363d] hover:border-[#484f58] hover:bg-[#262c36]'
      }`}
    >
      {/* Top line: Priority & Quick Actions */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${currentPriority.dot}`} />
          <span className={`text-xs font-semibold ${currentPriority.text}`}>
            {currentPriority.label}
          </span>
          {task.tags && task.tags.length > 0 && (
            <span className="text-xs text-slate-400 font-medium">
              · #{task.tags[0]}
            </span>
          )}
        </div>

        {/* Hover action icons */}
        <div className="flex items-center gap-1 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity">
          {!isDone && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStartFocus(task);
              }}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#30363d] transition"
              title="Focus on this task"
            >
              <Timer className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(task);
            }}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#30363d] transition"
            title="Edit"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(task.id);
            }}
            className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-[#30363d] transition"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Title & Complete Checkbox */}
      <div className="flex items-start gap-3">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onStatusChange(task.id, isDone ? 'todo' : 'done');
          }}
          className="mt-0.5 shrink-0 text-slate-400 hover:text-white transition"
          title={isDone ? 'Mark as incomplete' : 'Mark as complete'}
        >
          {isDone ? (
            <CheckCircle2 className="w-4.5 h-4.5 text-emerald-400" />
          ) : (
            <Circle className="w-4.5 h-4.5 text-slate-400 hover:text-white" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <h4
            onClick={() => onEdit(task)}
            className={`text-sm font-semibold leading-snug cursor-pointer transition ${
              isDone ? 'line-through text-slate-400' : 'text-slate-100 hover:text-white'
            }`}
          >
            {task.title}
          </h4>

          {task.description && (
            <p className="text-xs text-slate-300 leading-relaxed line-clamp-2 mt-1">
              {task.description}
            </p>
          )}
        </div>
      </div>

      {/* Subtasks snippet (if any) */}
      {totalSubtasks > 0 && (
        <div className="mt-3 pl-7">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5 font-medium">
            <span>Subtasks</span>
            <span>{completedSubtasks}/{totalSubtasks}</span>
          </div>
          <div className="space-y-1.5">
            {task.subtasks.map((sub) => (
              <div
                key={sub.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSubtask(task.id, sub.id);
                }}
                className="flex items-center gap-2 text-xs text-slate-300 hover:text-white cursor-pointer"
              >
                <div
                  className={`w-3.5 h-3.5 rounded-sm flex items-center justify-center border text-[9px] ${
                    sub.completed
                      ? 'bg-slate-600 border-slate-500 text-white'
                      : 'border-slate-500 bg-[#161b22]'
                  }`}
                >
                  {sub.completed && '✓'}
                </div>
                <span className={`truncate text-xs ${sub.completed ? 'line-through text-slate-400' : ''}`}>
                  {sub.title}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Card Footer: Deadline & Mobile Shift */}
      <div className="flex items-center justify-between pt-3 mt-3 border-t border-[#30363d]/80 text-xs">
        {/* Deadline */}
        <div>
          {task.dueDate ? (
            <div
              className={`flex items-center gap-1.5 font-medium ${
                isOverdue
                  ? 'text-rose-400'
                  : isDueToday
                  ? 'text-amber-400'
                  : 'text-slate-400'
              }`}
            >
              {isOverdue ? (
                <Clock className="w-3.5 h-3.5" />
              ) : (
                <Calendar className="w-3.5 h-3.5" />
              )}
              <span>
                {isOverdue ? 'Overdue' : isDueToday ? 'Today' : task.dueDate}
                {task.dueTime ? ` @ ${task.dueTime}` : ''}
              </span>
            </div>
          ) : (
            <span className="text-slate-500">No deadline</span>
          )}
        </div>

        {/* Quick Shift actions */}
        <div className="flex items-center gap-1.5 shrink-0 whitespace-nowrap">
          {task.status === 'in_progress' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStatusChange(task.id, 'todo');
              }}
              className="px-2 py-1 rounded bg-[#161b22] hover:bg-[#30363d] text-slate-300 hover:text-white border border-[#30363d] flex items-center gap-1 font-medium transition"
              title="Move to To Do"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>To Do</span>
            </button>
          )}

          {task.status === 'todo' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStatusChange(task.id, 'in_progress');
              }}
              className="px-2 py-1 rounded bg-[#161b22] hover:bg-[#30363d] text-slate-200 hover:text-white border border-[#30363d] flex items-center gap-1 font-medium transition"
              title="Start task"
            >
              <span>Start</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}

          {task.status === 'in_progress' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStatusChange(task.id, 'done');
              }}
              className="px-2 py-1 rounded bg-[#161b22] hover:bg-[#30363d] text-slate-200 hover:text-white border border-[#30363d] flex items-center gap-1 font-medium transition"
              title="Mark done"
            >
              <span>Done</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}

          {task.status === 'done' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStatusChange(task.id, 'in_progress');
              }}
              className="px-2 py-1 rounded bg-[#161b22] hover:bg-[#30363d] text-slate-300 hover:text-white border border-[#30363d] flex items-center gap-1 font-medium transition"
              title="Re-open"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Reopen</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
