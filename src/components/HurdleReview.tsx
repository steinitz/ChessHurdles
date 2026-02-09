import React, { useEffect, useState } from 'react';
import { getUserHurdles, deleteHurdle } from '~/lib/server/hurdles';
import { HurdleTable } from '~/lib/chess-database';
import { AnalysisCard } from './ChessGame/Analysis/AnalysisCard';
import { AnalysisDisplayItem } from './ChessGame/Analysis/analysis-formatter';

interface HurdleReviewProps {
  onSelectHurdle: (hurdle: HurdleTable) => void;
}

export function HurdleReview({ onSelectHurdle }: HurdleReviewProps) {
  const [hurdles, setHurdles] = useState<HurdleTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    getUserHurdles().then(setHurdles).finally(() => setLoading(false));
  }, []);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this hurdle?')) {
      try {
        await deleteHurdle({ data: id });
        setHurdles(prev => prev.filter(h => h.id !== id));
        if (selectedId === id) setSelectedId(null);
      } catch (error) {
        console.error('Failed to delete hurdle:', error);
        alert('Failed to delete hurdle');
      }
    }
  };

  const mapHurdleToDisplayItem = (hurdle: HurdleTable, index: number): AnalysisDisplayItem => {
    // Robustly handle legacy/missing data
    let playerColor: 'White' | 'Black' = 'White';
    try {
      if (hurdle.fen) {
        const parts = hurdle.fen.split(' ');
        if (parts.length > 1) {
          playerColor = parts[1] === 'w' ? 'White' : 'Black';
        }
      }
    } catch { }

    let metadata: any = {};
    try {
      if (hurdle.notes) {
        metadata = JSON.parse(hurdle.notes);
      }
    } catch { }

    const isWhiteMove = playerColor === 'White';
    const moveNum = hurdle.move_number || 0;
    const moveLabel = `${moveNum}${isWhiteMove ? '.' : '...'}`;

    // Determine classification from centipawn loss if available
    // or default to 'blunder' if loss is high?
    // Hurdle implies a mistake, so let's default to 'blunder' or 'mistake' based on loss.
    let classification: any = 'none';
    const loss = hurdle.centipawn_loss || 0;
    if (loss > 200) classification = 'blunder';
    else if (loss > 100) classification = 'mistake';
    else if (loss > 50) classification = 'inaccuracy';
    else if (loss > 0) classification = 'inaccuracy'; // Any hurdle is bad?

    return {
      index,
      moveNumber: moveNum,
      moveLabel,
      playerColor,
      absoluteMoveIndex: (moveNum * 2) - (isWhiteMove ? 2 : 1), // Approx ply
      moveSan: hurdle.played_move || '?',
      evaluation: hurdle.evaluation || 0,
      postMoveEvaluation: (hurdle.evaluation || 0) - (loss), // Rough estimate
      bestMove: hurdle.best_move || '?',
      classification,
      wpl: undefined, // Not stored
      centipawnChange: loss,
      aiDescription: hurdle.ai_description || undefined,
      isAiThrottled: false,
      mateIn: metadata.mateIn,
      calculationTime: metadata.calculationTime || 0,
      pv: undefined // Not stored easily yet (though logic saves it now)
    };
  };

  if (loading) return <div>Loading hurdles...</div>;

  return (
    <div className="p-4 border rounded bg-gray-50 mt-4">
      <h3>Hurdles to Review ({hurdles.length})</h3>
      {hurdles.length === 0 ? <p style={{ color: 'var(--color-text-secondary)' }}>No hurdles found.</p> : (
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {hurdles.map((hurdle, idx) => {
            const item = mapHurdleToDisplayItem(hurdle, idx);
            const isSelected = selectedId === hurdle.id;

            return (
              <div key={hurdle.id} className="relative group">
                <AnalysisCard
                  item={item}
                  onClick={() => {
                    setSelectedId(hurdle.id);
                    onSelectHurdle(hurdle);
                  }}
                  isActive={isSelected}
                />
                <button
                  onClick={(e) => handleDelete(e, hurdle.id)}
                  className="absolute top-1 right-1 text-red-500 hover:text-red-700 bg-white/80 rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm border border-gray-200"
                  title="Delete Hurdle"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
