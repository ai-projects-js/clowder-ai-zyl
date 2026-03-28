import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildTaskListSidebarItems, TaskListSidebar, type TaskListSidebarItem } from '@/components/TaskListSidebar';
import type { CatInvocationInfo } from '@/stores/chatStore';
import type { TaskItem } from '@/stores/taskStore';

vi.mock('@/components/CatAvatar', () => ({
  CatAvatar: ({ catId, size }: { catId: string; size?: number }) =>
    React.createElement('div', { 'data-testid': `cat-avatar-${catId}`, 'data-size': size ?? 0 }),
}));

describe('TaskListSidebar', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  afterAll(() => {
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  });

  it('renders passed tasks in order and highlights the doing item', async () => {
    const tasks: TaskListSidebarItem[] = [
      {
        id: 't-1',
        title: '理解任务需求并制定整体规划',
        ownerCatId: 'jiuwenclaw',
        status: 'done',
      },
      {
        id: 't-2',
        title: '开发主页 index.html',
        ownerCatId: 'codexclaw',
        status: 'doing',
      },
    ];

    await act(async () => {
      root.render(React.createElement(TaskListSidebar, { tasks }));
    });

    expect(container.textContent).toContain('执行列表');
    expect(container.textContent).toContain('理解任务需求并制定整体规划');
    expect(container.textContent).toContain('开发主页 index.html');
    expect(container.textContent).toContain('正在执行');

    const rows = [...container.querySelectorAll('[data-task-row]')];
    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toContain('1');
    expect(rows[1]?.textContent).toContain('2');
    expect(rows[1]?.getAttribute('data-task-status')).toBe('doing');
    expect(rows[1]?.getAttribute('data-task-active')).toBe('true');
  });

  it('prefers tool events from the latest streaming assistant message', () => {
    const tasks = buildTaskListSidebarItems({
      targetCats: ['codexclaw'],
      catInvocations: {},
      persistedTasks: [],
      messages: [
        {
          id: 'msg-1',
          type: 'assistant',
          catId: 'codexclaw',
          content: ['1. 这段正文编号不应该出现在侧栏', '2. 侧栏应该显示 tool 调用'].join('\n'),
          timestamp: 100,
          isStreaming: true,
          toolEvents: [
            {
              id: 'tool-1',
              type: 'tool_use',
              label: 'codexclaw → command_execution',
              detail: '{"command":"pnpm test"}',
              timestamp: 110,
            },
            {
              id: 'tool-2',
              type: 'tool_result',
              label: 'codexclaw ← result',
              detail: 'ok',
              timestamp: 120,
            },
            {
              id: 'tool-3',
              type: 'tool_use',
              label: 'codexclaw → mcp:cat-cafe/read_file',
              detail: '{"file_path":"packages/web/src/components/TaskListSidebar.tsx"}',
              timestamp: 130,
            },
          ],
        },
      ] as never,
      threadId: 'thread-a',
    });

    expect(tasks).toHaveLength(2);
    expect(tasks[0]).toMatchObject({
      ownerCatId: 'codexclaw',
      title: 'command_execution pnpm test',
      status: 'done',
    });
    expect(tasks[1]).toMatchObject({
      ownerCatId: 'codexclaw',
      title: 'mcp:cat-cafe/read_file packages/web/src/components/TaskListSidebar.tsx',
      status: 'doing',
    });
  });

  it('falls back to live taskProgress only when there are no tool events', () => {
    const catInvocations: Record<string, CatInvocationInfo> = {
      codexclaw: {
        startedAt: 123,
        taskProgress: {
          lastUpdate: 456,
          snapshotStatus: 'running',
          tasks: [
            { id: 'live-1', subject: '设计用户交互体验并写入 interaction.md', status: 'completed' },
            {
              id: 'live-2',
              subject: '开发主页 index.html',
              activeForm: '正在开发主页 index.html',
              status: 'in_progress',
            },
          ],
        },
      },
    };
    const persistedTasks: TaskItem[] = [
      {
        id: 'db-1',
        threadId: 'thread-a',
        title: '旧的数据库任务',
        ownerCatId: 'jiuwenclaw',
        status: 'todo',
        why: '',
        createdBy: 'user',
        createdAt: 1,
        updatedAt: 1,
      },
    ];

    const tasks = buildTaskListSidebarItems({
      targetCats: ['codexclaw'],
      catInvocations,
      persistedTasks,
      messages: [],
      threadId: 'thread-a',
    });

    expect(tasks).toHaveLength(2);
    expect(tasks[0]).toMatchObject({
      ownerCatId: 'codexclaw',
      title: '设计用户交互体验并写入 interaction.md',
      status: 'done',
    });
    expect(tasks[1]).toMatchObject({
      ownerCatId: 'codexclaw',
      title: '正在开发主页 index.html',
      status: 'doing',
    });
  });

  it('does not extract numbered prose steps when tool events and task progress are missing', () => {
    const tasks = buildTaskListSidebarItems({
      targetCats: ['codexclaw'],
      catInvocations: {},
      persistedTasks: [],
      messages: [
        {
          id: 'msg-1',
          type: 'assistant',
          catId: 'codexclaw',
          content: ['1. 理解任务需求并制定整体规划', '2. 设计用户交互体验并写入 interaction.md', '3. 开发主页 index.html'].join(
            '\n',
          ),
          timestamp: 100,
          isStreaming: true,
        },
      ] as never,
      threadId: 'thread-a',
    });

    expect(tasks).toEqual([]);
  });
});
