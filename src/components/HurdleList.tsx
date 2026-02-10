import React, { useEffect, useState } from 'react';
import { getUserHurdles, deleteHurdle } from '~/lib/server/hurdles';
import { HurdleTable } from '~/lib/chess-database';
import { AnalysisCard } from './ChessGame/Analysis/AnalysisCard';
import { AnalysisDisplayItem } from './ChessGame/Analysis/analysis-formatter';

interface HurdleListProps {
  onSelect: (hurdle: HurdleTable) => void;
  selectedId: string | null;
}

export function HurdleList({ onSelect, selectedId }: HurdleListProps) {
  const [hurdles, setHurdles] = useState<HurdleTable[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getUserHurdles().then((fetched) => {
      console.log('DEBUG: Fetched all hurdles:', fetched);
      if (fetched && fetched.length > 0) {
        console.log('DEBUG: First hurdle keys:', Object.keys(fetched[0]));
        console.log('DEBUG: First hurdle content:', fetched[0]);
      }
      setHurdles(fetched);
      if (fetched.length > 0 && !selectedId) {
        onSelect(fetched[0]);
      }
    }).finally(() => setLoading(false));
  }, []);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this hurdle?')) {
      try {
        await deleteHurdle({ data: id });
        setHurdles(prev => prev.filter(h => h.id !== id));
        // Note: selectedId is a prop, we can't set it here. 
        // We'd need an onSelect(null) if we wanted to deselect, 
        // but typically the parent will handle this if the hurdle is gone.
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
    const moveNum = (hurdle as any).move_number ?? (hurdle as any).moveNumber ?? 0;
    const moveLabel = `${moveNum}${isWhiteMove ? '.' : '...'}`;

    // Determine classification from centipawn loss if available
    // or default to 'blunder' if loss is high?
    // Hurdle implies a mistake, so let's default to 'blunder' or 'mistake' based on loss.
    let classification: any = 'none';
    const loss = (hurdle as any).centipawn_loss ?? (hurdle as any).centipawnLoss ?? 0;
    if (loss > 200) classification = 'blunder';
    else if (loss > 100) classification = 'mistake';
    else if (loss > 50) classification = 'inaccuracy';
    else if (loss > 0) classification = 'inaccuracy'; // Any hurdle is bad?

    return {
      index,
      moveNumber: moveNum,
      moveLabel,
      playerColor,
      isWhiteMove,
      absoluteMoveIndex: (moveNum * 2) - (isWhiteMove ? 2 : 1), // Approx ply
      moveSan: (hurdle as any).played_move ?? (hurdle as any).playedMove ?? '?',
      evaluation: (hurdle as any).evaluation ?? 0,
      postMoveEvaluation: ((hurdle as any).evaluation ?? 0) - (loss), // Rough estimate
      bestMove: (hurdle as any).best_move ?? (hurdle as any).bestMove ?? '?',
      classification,
      wpl: (hurdle as any).wpl,
      centipawnChange: loss,
      aiDescription: (hurdle as any).ai_description ?? (hurdle as any).aiDescription ?? undefined,
      isAiThrottled: false,
      mateIn: metadata.mateIn,
      calculationTime: metadata.calculationTime || 0,
      pv: undefined // Not stored easily yet (though logic saves it now)
    };
  };

  if (loading) return <div>Loading hurdles...</div>;

  return (

    <div style={{
      marginTop: '1rem',
      padding: '1rem',
      border: '1px solid var(--color-border)',
      borderRadius: '0.25rem',
      backgroundColor: 'transparent',
    }}>
      <h3 style={{ marginTop: 0 }}>Hurdles to Review ({hurdles.length})</h3>
      {hurdles.length === 0 ? <p style={{ color: 'var(--color-text-secondary)' }}>No hurdles found.</p> : (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          maxHeight: '600px',
          overflowY: 'auto'
        }}>
          {hurdles.map((hurdle, idx) => {
            const item = mapHurdleToDisplayItem(hurdle, idx);
            const isSelected = selectedId === hurdle.id;

            return (
              <div key={hurdle.id} style={{ position: 'relative' }}>
                <AnalysisCard
                  item={item}
                  onClick={() => {
                    onSelect(hurdle);
                  }}
                  isActive={isSelected}
                  onDelete={(e) => handleDelete(e, hurdle.id)}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

}
