'use client';

import type { CatInvocationInfo, ChatMessage } from '@/stores/chatStore';
import type { TaskItem } from '@/stores/taskStore';
import { CatAvatar } from './CatAvatar';
import { toCliEvents } from './cli-output/toCliEvents';

export interface TaskListSidebarItem {
  id: string;
  title: string;
  ownerCatId: string | null;
  status: 'todo' | 'doing' | 'blocked' | 'done';
}

interface TaskListSidebarProps {
  tasks: TaskListSidebarItem[];
  className?: string;
}

interface BuildTaskListSidebarItemsArgs {
  targetCats: string[];
  catInvocations: Record<string, CatInvocationInfo>;
  persistedTasks: TaskItem[];
  messages: ChatMessage[];
  threadId: string;
}

function ClipboardListIcon() {
  return (
    <svg className="h-4 w-4 text-neutral-700" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="4" y="3.5" width="12" height="13" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 3.5h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M7 8h6M7 11h6M7 14h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function DoneIcon() {
  return (
    <svg className="h-5 w-5 text-emerald-500" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
      <path d="m6.5 10.25 2.3 2.3 4.7-5.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BlockedIcon() {
  return (
    <svg className="h-5 w-5 text-amber-500" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 6.2v4.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="10" cy="13.9" r="0.9" fill="currentColor" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="h-3.5 w-3.5 animate-spin text-blue-500" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M16.5 10a6.5 6.5 0 1 1-2.1-4.8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function getTaskRowClasses(status: TaskListSidebarItem['status']): string {
  if (status === 'doing') return 'bg-blue-50 ring-1 ring-inset ring-blue-100';
  return 'bg-white';
}

function getIndexClasses(status: TaskListSidebarItem['status']): string {
  if (status === 'doing') return 'bg-blue-500 text-white';
  return 'bg-neutral-100 text-neutral-500';
}

function normalizePersistedTask(task: TaskItem): TaskListSidebarItem {
  return {
    id: task.id,
    title: task.title,
    ownerCatId: task.ownerCatId,
    status: task.status,
  };
}

function mapLiveTaskStatus(status: 'pending' | 'in_progress' | 'completed'): TaskListSidebarItem['status'] {
  if (status === 'in_progress') return 'doing';
  if (status === 'completed') return 'done';
  return 'todo';
}

function extractToolTasksFromMessages(messages: ChatMessage[]): TaskListSidebarItem[] {
  const relevantMessages = messages.filter((message) => (message.toolEvents?.length ?? 0) > 0);
  if (relevantMessages.length === 0) return [];

  const streamingMessages = relevantMessages.filter((message) => message.isStreaming);
  const sourceMessages =
    streamingMessages.length > 0
      ? [...streamingMessages].sort((a, b) => a.timestamp - b.timestamp)
      : [relevantMessages.reduce((latest, message) => (message.timestamp > latest.timestamp ? message : latest))];

  const toolRows = sourceMessages.flatMap((message) =>
    toCliEvents(message.toolEvents, undefined)
      .filter((event) => event.kind === 'tool_use' && event.label)
      .map((event) => ({
        id: event.id,
        title: event.label as string,
        ownerCatId: message.catId ?? null,
        timestamp: event.timestamp,
      })),
  );

  if (toolRows.length === 0) return [];

  const activeToolId =
    streamingMessages.length > 0
      ? toolRows.reduce((latest, row) => (row.timestamp > latest.timestamp ? row : latest)).id
      : null;

  return toolRows.map(({ timestamp: _timestamp, ...row }) => ({
    ...row,
    status: row.id === activeToolId ? 'doing' : 'done',
  }));
}

export function buildTaskListSidebarItems({
  targetCats,
  catInvocations,
  persistedTasks,
  messages,
  threadId,
}: BuildTaskListSidebarItemsArgs): TaskListSidebarItem[] {
  const orderedCatIds = [...new Set([...targetCats, ...Object.keys(catInvocations)])];

  const candidateMessages = messages
    .filter((message) => {
      if (message.type !== 'assistant') return false;
      if ((message.toolEvents?.length ?? 0) === 0) return false;
      if (orderedCatIds.length === 0) return true;
      return !!message.catId && orderedCatIds.includes(message.catId);
    })
    .sort((a, b) => a.timestamp - b.timestamp);

  const toolTasks = extractToolTasksFromMessages(candidateMessages);
  if (toolTasks.length > 0) return toolTasks;

  const liveTasks = orderedCatIds.flatMap((catId) => {
    const taskProgress = catInvocations[catId]?.taskProgress;
    if (!taskProgress || taskProgress.tasks.length === 0) return [];

    return taskProgress.tasks.map((task, index) => ({
      id: `${catId}:${task.id}:${index}`,
      title: task.status === 'in_progress' ? (task.activeForm ?? task.subject) : task.subject,
      ownerCatId: catId,
      status: mapLiveTaskStatus(task.status),
    }));
  });

  if (liveTasks.length > 0) return liveTasks;

  const safePersistedTasks = Array.isArray(persistedTasks) ? persistedTasks : [];

  return safePersistedTasks
    .filter((task) => task.threadId === threadId)
    .sort((a, b) => {
      const order = (a.createdAt || a.updatedAt || 0) - (b.createdAt || b.updatedAt || 0);
      if (order !== 0) return order;
      return a.title.localeCompare(b.title);
    })
    .map(normalizePersistedTask);
}

function TaskRow({
  index,
  task,
}: {
  index: number;
  task: TaskListSidebarItem;
}) {
  const isActive = task.status === 'doing';

  return (
    <div
      data-task-row
      data-task-status={task.status}
      data-task-active={isActive ? 'true' : 'false'}
      className={`flex items-start gap-3 rounded-xl px-3 py-3 transition-colors ${getTaskRowClasses(task.status)}`}
    >
      <div
        className={`mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${getIndexClasses(task.status)}`}
      >
        {index}
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-medium leading-6 text-neutral-800">{task.title}</div>
      </div>

      <div className="flex shrink-0 items-center gap-2 pl-1">
        {task.ownerCatId ? <CatAvatar catId={task.ownerCatId} size={20} /> : null}

        {task.status === 'doing' ? (
          <div className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-[13px] font-semibold text-blue-600">
            <span>正在执行</span>
            <SpinnerIcon />
          </div>
        ) : null}

        {task.status === 'done' ? <DoneIcon /> : null}
        {task.status === 'blocked' ? <BlockedIcon /> : null}
      </div>
    </div>
  );
}

export function TaskListSidebar({ tasks, className = 'overflow-y-auto' }: TaskListSidebarProps) {
  if (tasks.length === 0) return null;

  return (
    <aside className={className} aria-label="执行列表侧栏">
      <div className="sticky top-4 overflow-hidden rounded-2xl border border-black/5 bg-white/92 shadow-sm backdrop-blur">
        <div className="flex items-center gap-2 border-b border-neutral-200 px-4 py-4">
          <ClipboardListIcon />
          <h2 className="text-[15px] font-semibold text-neutral-800">执行列表</h2>
        </div>

        <div className="space-y-1.5 px-3 py-3">
          {tasks.map((task, index) => (
            <TaskRow key={task.id} index={index + 1} task={task} />
          ))}
        </div>
      </div>
    </aside>
  );
}
