import React, { useState, useMemo } from 'react';
import type { NoteType } from '../../../../core/models/noteType';
import { TemplateRenderer } from '../../../../core/templates/templateRenderer';
import { ClozeEngine } from '../../../../core/templates/clozeEngine';
import { ShadowCardContainer } from '../../../components/ShadowCardContainer';
import { SegmentedControl } from '../../../components/SegmentedControl';
import { Eye, Layers } from 'lucide-react';

export interface LiveCardPreviewProps {
  noteType: NoteType;
  fieldValues: Record<string, string>;
  className?: string;
}

export const LiveCardPreview: React.FC<LiveCardPreviewProps> = ({
  noteType,
  fieldValues,
  className = '',
}) => {
  const [activeSide, setActiveSide] = useState<'front' | 'back'>('front');
  const [selectedCardIdx, setSelectedCardIdx] = useState(0);

  // Determine generated cards based on NoteType
  const cardDefinitions = useMemo(() => {
    if (noteType.isCloze) {
      // Find the cloze field (usually "Text")
      const text = fieldValues['Text'] || Object.values(fieldValues)[0] || '';
      const indices = ClozeEngine.extractClozeIndices(text);
      const activeIndices = indices.length > 0 ? indices : [1];

      return activeIndices.map((clozeIdx: number, i: number) => ({
        index: i,
        label: `Cloze ${clozeIdx}`,
        template: noteType.templates[0] ?? { name: 'Cloze', qfmt: '{{cloze:Text}}', afmt: '{{cloze:Text}}<br>{{Extra}}' },
        clozeIndex: clozeIdx,
      }));
    }

    // Standard templates (e.g. Card 1: Forward, Card 2: Reverse)
    return noteType.templates.map((tpl, i: number) => ({
      index: i,
      label: tpl.name || `Card ${i + 1}`,
      template: tpl,
      clozeIndex: 1,
    }));
  }, [noteType, fieldValues]);

  // Ensure selected index is in range
  const safeIndex = selectedCardIdx < cardDefinitions.length ? selectedCardIdx : 0;
  const currentCard = cardDefinitions[safeIndex];

  // Render question and answer HTML using TemplateRenderer
  const rendered = useMemo(() => {
    if (!currentCard) {
      return { questionHtml: '<i>No card template available</i>', answerHtml: '' };
    }

    try {
      return TemplateRenderer.render(currentCard.template, fieldValues, {
        clozeIndex: currentCard.clozeIndex,
      });
    } catch {
      return {
        questionHtml: '<p class="text-danger">Template render error</p>',
        answerHtml: '',
      };
    }
  }, [currentCard, fieldValues]);

  const displayedHtml = activeSide === 'front' ? rendered.questionHtml : rendered.answerHtml;
  const isEmptyContent = !displayedHtml || displayedHtml.trim() === '';

  return (
    <div className={`space-y-3 rounded-[var(--radius-lg)] bg-[var(--bg-subtle)] border border-[var(--border-subtle)] p-4 ${className}`}>
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--divider)]">
        <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]">
          <Eye className="w-4 h-4 text-[var(--accent)]" />
          <span>Live Card Preview</span>
          <span className="text-[11px] font-mono text-[var(--text-tertiary)]">
            ({cardDefinitions.length} {cardDefinitions.length === 1 ? 'card' : 'cards'})
          </span>
        </div>

        {/* Side Selector (Question vs Answer) */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <SegmentedControl
            size="sm"
            value={activeSide}
            onChange={(val) => setActiveSide(val as 'front' | 'back')}
            options={[
              { value: 'front', label: 'Front (Q)' },
              { value: 'back', label: 'Back (A)' },
            ]}
          />
        </div>
      </div>

      {/* Multi-Card Selector Tabs if NoteType generates > 1 Card */}
      {cardDefinitions.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <span className="text-[11px] text-[var(--text-tertiary)] flex items-center gap-1 mr-1 shrink-0">
            <Layers className="w-3.5 h-3.5" />
            <span>Cards:</span>
          </span>
          {cardDefinitions.map((c) => (
            <button
              key={c.index}
              type="button"
              onClick={() => setSelectedCardIdx(c.index)}
              className={`
                px-2.5 py-1 text-xs font-medium rounded-[var(--radius-sm)] transition-colors cursor-pointer shrink-0
                ${
                  safeIndex === c.index
                    ? 'bg-[var(--accent)] text-[var(--accent-contrast)] shadow-xs font-semibold'
                    : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)]'
                }
              `}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {/* Shadow DOM Isolated Preview Area */}
      <div className="min-h-[140px] max-h-[300px] overflow-y-auto rounded-[var(--radius-md)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-5 shadow-xs">
        {isEmptyContent ? (
          <div className="py-8 text-center text-xs text-[var(--text-tertiary)] italic">
            Enter field values above to preview rendered card content...
          </div>
        ) : (
          <ShadowCardContainer html={displayedHtml} css={noteType.css} />
        )}
      </div>
    </div>
  );
};
