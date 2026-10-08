import { useEffect, useRef } from 'react';
import type { SimulationState } from '../controllers/SimulationController';

interface ComparisonPanelProps {
  state: SimulationState;
  template: string;
}

/** Align the input and template in one compact scrolling viewport with synchronized pointers. */
export default function ComparisonPanel({ state, template }: ComparisonPanelProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const comparing = state.status !== 'idle' && state.status !== 'loading';

  useEffect(() => {
    const viewport = viewportRef.current;
    const current = viewport?.querySelector<HTMLElement>('[aria-current="step"]');
    if (viewport && current) {
      const left = current.offsetLeft - viewport.clientWidth / 2 + current.clientWidth / 2;
      viewport.scrollLeft = Math.max(0, left);
    }
  }, [state.inputIndex, state.templateIndex, state.status]);

  function renderRow(label: string, text: string, pointer: number, row: 'word' | 'template') {
    const chars = Array.from(text);
    return (
      <div className="comparison-row" data-row={row} aria-label={`${label}: ${text || 'пустое'}`}>
        <strong className="comparison-label">{label}</strong>
        <div className="comparison-symbols">
          {chars.map((char, index) => {
            const current = comparing && index === pointer;
            const matched = comparing && index < pointer;
            return <div key={index} className={`word-symbol ${matched ? 'is-matched' : ''} ${current ? 'is-current' : ''}`} data-symbol-index={index} aria-current={current ? 'step' : undefined}>
              <span className="symbol-pointer" aria-hidden="true">{current ? '↓' : '\u00a0'}</span>
              <span className="symbol-cell">{char === ' ' ? '␣' : char}</span>
            </div>;
          })}
        </div>
      </div>
    );
  }

  return (
    <section className="comparison-panel" aria-label="Сопоставление входного слова и шаблона">
      <div className="comparison-track" ref={viewportRef}>
        {renderRow('Входное слово', state.inputWord, state.inputIndex, 'word')}
        {renderRow('Шаблон', template, state.templateIndex, 'template')}
      </div>
    </section>
  );
}
