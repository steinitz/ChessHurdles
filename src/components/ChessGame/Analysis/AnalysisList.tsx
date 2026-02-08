import React, { useState } from 'react';
import type { AnalysisDisplayItem } from './analysis-formatter';

interface AnalysisListProps {
  items: AnalysisDisplayItem[];
  onMoveClick: (index: number) => void;
  hideInaccuracies: boolean;
  showAllMoves?: boolean; // New prop for showing 'none'/'good' moves
  currentMoveIndex?: number;
}

const CLASSIFICATION_STYLES = {
  blunder: { borderLeft: '4px solid var(--color-error, var(--color-danger))', bg: 'rgba(255, 0, 0, 0.05)' },
  mistake: { borderLeft: '4px solid var(--color-text)', bg: 'rgba(128, 128, 128, 0.1)' },
  inaccuracy: { borderLeft: '4px solid var(--color-text-secondary)', bg: 'rgba(128, 128, 128, 0.05)' },
  good: { borderLeft: '4px solid transparent', bg: 'transparent' },
  none: { borderLeft: '4px solid transparent', bg: 'transparent' },
};

const AnalysisCard: React.FC<{ item: AnalysisDisplayItem; onClick: () => void; isActive: boolean }> = ({ item, onClick, isActive }) => {
  const style = CLASSIFICATION_STYLES[item.classification || 'none'];

  // Suffix for move annotation
  const suffix = item.classification === 'blunder' ? '??'
    : item.classification === 'mistake' ? '?'
      : item.classification === 'inaccuracy' ? '?!'
        : '';

  const preEval = item.evaluation;
  const postEval = item.postMoveEvaluation;

  const hasPost = postEval !== undefined;

  const formatEval = (v: number) => {
    if (item.mateIn) return `M${Math.abs(item.mateIn)}`;
    const sign = v > 0 ? '+' : '';
    return `${sign}${(v / 100).toFixed(2)}`;
  }

  const preText = formatEval(preEval);
  const postText = hasPost ? formatEval(postEval!) : '?';

  // Eval Color (based on Post if avail, else Pre)
  const evalVal = hasPost ? postEval! : preEval;
  const evalColor = evalVal > 0 ? 'var(--color-success)' : evalVal < 0 ? 'var(--color-danger)' : 'var(--color-text-secondary)';

  const labelColor = item.classification === 'blunder' ? 'var(--color-error, var(--color-danger))'
    : item.classification === 'mistake' ? 'var(--color-text)'
      : item.classification === 'inaccuracy' ? 'var(--color-text-secondary)'
        : 'var(--color-text-secondary)';

  // Truncate PV logic
  // "Best: [move] [pv...]"
  // Limit to approx 8 moves or 60 chars.
  // Best Move provided by engine (from Pre position) is the "Best Move" to play.
  // We want to show "Best: e4 ..."
  let bestMoveText = item.bestMove !== '?' ? item.bestMove : '';

  // Clean up PV display: Remove redundant bestMove if PV starts with it.
  // PV usually starts with bestMove.
  // If we have AI description, show that.
  // Else show PV.

  let displayText = '';

  if (item.aiDescription) {
    displayText = item.aiDescription;
  } else if (item.pv) {
    // PV contains the full line. No need to prefix "Best:".
    // Just "Best: e4 d5..."
    displayText = `Best: ${item.pv}`;
  } else if (bestMoveText) {
    displayText = `Best: ${bestMoveText}`;
  }

  // Truncate display text to avoid overflow
  const truncatedText = displayText.length > 70 ? displayText.slice(0, 70) + '...' : displayText;

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{
        display: 'grid',
        gridTemplateColumns: '40px 60px 80px 1fr', // Grid Layout as requested (Tab-like)
        gap: '8px',
        alignItems: 'center',
        padding: '6px 8px',
        borderBottom: '1px solid var(--color-border)',
        backgroundColor: isActive ? 'var(--color-bg-secondary)' : (style.bg || 'var(--color-bg)'),
        fontSize: '0.90em',
        fontFamily: 'var(--font-sans)',
        cursor: 'pointer',
        lineHeight: '1.4'
      }}
    >
      {/* Col 1: Move Number */}
      <span style={{ color: 'var(--color-text-secondary)', textAlign: 'right' }}>
        {item.moveLabel}
      </span>

      {/* Col 2: Move Sanitized */}
      <span style={{ fontWeight: 'bold', color: 'var(--color-text)' }}>
        {item.moveSan}{suffix}
      </span>

      {/* Col 3: Eval (Pre -> Post or just Post) */}
      <span style={{ fontSize: '0.9em', whiteSpace: 'nowrap' }}>
        {item.centipawnChange && item.centipawnChange > 10 ? (
          // Significant change: Show transition
          <span>
            <span style={{ color: 'var(--color-text-tertiary)' }}>{preText}</span>
            <span style={{ margin: '0 2px' }}>→</span>
            <span style={{ color: evalColor, fontWeight: 'bold' }}>{postText}</span>
          </span>
        ) : (
          // Stable/No change: Show single eval
          <span style={{ color: evalColor, fontWeight: 'bold' }}>{postText}</span>
        )}
      </span>

      {/* Col 4: Text (Best move / AI / Classification) */}
      <span style={{
        color: 'var(--color-text-secondary)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        display: 'flex',
        alignItems: 'center'
      }}>
        {item.classification !== 'none' && (
          <span style={{
            color: labelColor,
            fontWeight: '600',
            fontSize: '0.85em',
            marginRight: '6px',
            textTransform: 'capitalize'
          }}>
            {item.classification}
          </span>
        )}
        <span style={{ fontStyle: 'italic', title: displayText } as any}>
          [{truncatedText}]
        </span>
      </span>
    </div>
  );
};

export const AnalysisList: React.FC<AnalysisListProps> = ({ items, onMoveClick, hideInaccuracies, showAllMoves, currentMoveIndex }) => {
  const filteredItems = items.filter(item => {
    // Hide 'none' or 'good' unless showAllMoves is true
    if (!showAllMoves && (item.classification === 'none' || item.classification === 'good')) return false;

    if (hideInaccuracies && item.classification === 'inaccuracy') return false;
    return true;
  });

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      // overflowY: 'auto' handled by parent container settings passed via style or className usually, 
      // but here we are inside the resizable div from GameAnalysis.
      // So height 100% takes the parent's height.
    }}>
      {filteredItems.length === 0 ? (
        <div style={{ padding: '16px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
          No analysis data available.
        </div>
      ) : (
        filteredItems.map((item) => (
          <AnalysisCard
            key={item.index}
            item={item}
            onClick={() => onMoveClick(item.index)} // item.index maps to game index
            isActive={currentMoveIndex === item.index}
          />
        ))
      )}
    </div>
  );
};
