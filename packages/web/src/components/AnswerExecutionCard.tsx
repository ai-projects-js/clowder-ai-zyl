'use client';

import { useMemo, useState } from 'react';
import type { CliEvent, CliStatus } from '@/stores/chat-types';

interface AnswerExecutionCardProps {
  events: CliEvent[];
  status: CliStatus;
  title?: string;
}

interface ExecutionSection {
  id: string;
  items: CliEvent[];
  state: 'done' | 'active';
}

function chunkToolEvents(events: CliEvent[], status: CliStatus): ExecutionSection[] {
  const toolEvents = events.filter((event) => event.kind === 'tool_use');
  if (toolEvents.length === 0) return [];

  const sections: ExecutionSection[] = [];
  for (let index = 0; index < toolEvents.length; index += 3) {
    sections.push({
      id: `section-${index}`,
      items: toolEvents.slice(index, index + 3),
      state: 'done',
    });
  }

  if (status === 'streaming') {
    const lastSection = sections.at(-1);
    if (lastSection) lastSection.state = 'active';
  }

  return sections;
}

function trimTitle(title?: string): string {
  if (!title) return '执行过程';
  const normalized = title.replace(/\s+/g, ' ').trim();
  if (!normalized) return '执行过程';
  return normalized.length > 32 ? `${normalized.slice(0, 29)}...` : normalized;
}

function iconForToolLabel(label: string): string {
  const lower = label.toLowerCase();
  if (lower.includes('read') || lower.includes('file')) return 'DOC';
  if (lower.includes('search')) return 'SRCH';
  if (lower.includes('command') || lower.includes('bash')) return 'CMD';
  if (lower.includes('mcp:')) return 'MCP';
  return 'TOOL';
}

function SectionStatusIcon({ state }: { state: ExecutionSection['state'] }) {
  if (state === 'active') {
    return (
      <span
        aria-hidden="true"
        className="inline-block h-[18px] w-[18px] rounded-full border-2 border-slate-400 border-t-transparent animate-spin"
      />
    );
  }

  return (
    <span className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[#D6D8DD] text-[11px] font-bold text-white">
      ✓
    </span>
  );
}

function ToolPill({ event }: { event: CliEvent }) {
  return (
    <div className="inline-flex w-full items-center gap-2 rounded-2xl bg-[#F3F4F7] px-[14px] py-[8px] text-sm text-[#8C9098]">
      <span className="inline-flex min-w-[28px] items-center justify-center rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.04em] text-[#8E949C]">
        {iconForToolLabel(event.label ?? '')}
      </span>
      <span className="truncate">{event.label}</span>
    </div>
  );
}

function ExecutionSectionView({ section }: { section: ExecutionSection }) {
  const [expanded, setExpanded] = useState(true);
  const isActive = section.state === 'active';

  return (
    <div className="flex flex-col gap-[10px]">
      <button type="button" className="flex items-center gap-[10px] text-left" onClick={() => setExpanded((value) => !value)}>
        <SectionStatusIcon state={section.state} />
        <span className="text-base font-bold text-[#2D3340]">已执行{section.items.length}次工具调用</span>
        <span className="text-sm text-[#7E838C]">{expanded ? '^' : 'v'}</span>
      </button>

      {expanded ? (
        <div className="flex gap-3">
          <div className="flex w-[18px] justify-center">
            <div className={`w-px rounded-full ${isActive ? 'bg-[#C8D7F2]' : 'bg-[#D9DCE1]'}`} style={{ minHeight: `${section.items.length * 38 + (section.items.length - 1) * 10}px` }} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-[10px]">
            {section.items.map((event) => (
              <ToolPill key={event.id} event={event} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function buildAnswerExecutionTitle(input: { title?: string; fallbackEvents: CliEvent[] }): string {
  const directTitle = trimTitle(input.title);
  if (directTitle !== '执行过程') return directTitle;

  const firstTool = input.fallbackEvents.find((event) => event.kind === 'tool_use' && event.label)?.label;
  return trimTitle(firstTool ? `执行中: ${firstTool}` : undefined);
}

export function AnswerExecutionCard({ events, status, title }: AnswerExecutionCardProps) {
  const sections = useMemo(() => chunkToolEvents(events, status), [events, status]);
  if (sections.length === 0) return null;

  const displayTitle = buildAnswerExecutionTitle({ title, fallbackEvents: events });

  return (
    <section className="mt-3 rounded-[22px] border border-[#E8EDF5] bg-white px-5 py-4 shadow-[0_12px_32px_rgba(31,45,61,0.06)]" data-testid="answer-execution-card">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-[10px]">
          <div className="flex items-center gap-[6px]">
            <span className="h-[6px] w-[6px] rounded-full bg-[#73CBFF]" />
            <span className="h-[6px] w-[6px] rounded-full bg-[#9FDFFF]" />
          </div>
          <h3 className="text-lg font-bold text-[#202633]">{displayTitle}</h3>
        </div>

        <div className="flex flex-col gap-[14px]">
          {sections.map((section) => (
            <ExecutionSectionView key={section.id} section={section} />
          ))}
        </div>
      </div>
    </section>
  );
}
