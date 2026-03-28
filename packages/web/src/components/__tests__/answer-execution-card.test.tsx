import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AnswerExecutionCard } from '@/components/AnswerExecutionCard';
import type { CliEvent } from '@/stores/chat-types';

describe('AnswerExecutionCard', () => {
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

  it('renders grouped tool sections from the design-style card', () => {
    const events: CliEvent[] = [
      { id: '1', kind: 'tool_use', timestamp: 1, label: 'command_execution pnpm test' },
      { id: '2', kind: 'tool_use', timestamp: 2, label: 'mcp:filesystem/read_file packages/web/src/app.tsx' },
      { id: '3', kind: 'tool_use', timestamp: 3, label: 'web_search GTC keynote' },
      { id: '4', kind: 'tool_use', timestamp: 4, label: 'command_execution pnpm build' },
    ];

    act(() => {
      root.render(React.createElement(AnswerExecutionCard, { events, status: 'streaming', title: '查询GTC数据并整理' }));
    });

    const text = container.textContent ?? '';
    expect(text).toContain('查询GTC数据并整理');
    expect(text).toContain('已执行3次工具调用');
    expect(text).toContain('已执行1次工具调用');
    expect(text).toContain('command_execution pnpm test');
    expect(text).toContain('mcp:filesystem/read_file packages/web/src/app.tsx');
    expect(text).toContain('web_search GTC keynote');
    expect(text).toContain('command_execution pnpm build');
  });
});
