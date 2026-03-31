'use client';

import { CatAvatar } from './CatAvatar';

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function formatRecognitionTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function RecognitionDots() {
  return (
    <span aria-hidden="true" className="relative mt-1 inline-flex h-5 w-5 flex-shrink-0">
      <span className="absolute left-0 top-2 h-1.5 w-1.5 rounded-full bg-[#A8D45E]" />
      <span className="absolute left-2 top-0 h-1.5 w-1.5 rounded-full bg-[#B8E06B]" />
      <span className="absolute left-3.5 top-3 h-1.5 w-1.5 rounded-full bg-[#8FC34B]" />
    </span>
  );
}

interface IntentRecognitionPlaceholderProps {
  timestamp: number;
}

export function IntentRecognitionPlaceholder({ timestamp }: IntentRecognitionPlaceholderProps) {
  return (
    <div data-testid="intent-recognition-placeholder" className="answer-group group flex gap-3 pb-2 pt-1 items-start">
      <CatAvatar catId="jiuwenclaw" size={32} />
      <div className="min-w-0 max-w-[85%] md:max-w-[75%]">
        <div className="mb-1 flex items-center gap-3 text-xs text-[rgb(128_128_128)]">
          <span>主智能体</span>
          <span data-testid="intent-recognition-time">{formatRecognitionTimestamp(timestamp)}</span>
        </div>
        <div className="flex items-center gap-3 text-[16px] text-[#1F1F1F] md:text-[18px]">
          <RecognitionDots />
          <span>正在识别你的需求...</span>
        </div>
      </div>
    </div>
  );
}
