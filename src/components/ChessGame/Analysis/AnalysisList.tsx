import React from 'react';
import type { AnalysisDisplayItem } from './analysis-formatter';
import { AnalysisCard } from './AnalysisCard';

interface AnalysisListProps {
  items: AnalysisDisplayItem[];
  onMoveClick: (index: number) => void;
  hideInaccuracies: boolean;
  showAllMoves?: boolean; // New prop for showing 'none'/'good' moves
  currentMoveIndex?: number;
}

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
      // overflowY: 'auto' handled by parent container
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
            onClick={() => onMoveClick(item.index)}
            isActive={currentMoveIndex === item.absoluteMoveIndex}
          />
        ))
      )}
    </div>
  );
};

