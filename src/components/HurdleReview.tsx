import React, { useEffect, useState } from 'react';
import { getUserHurdles, deleteHurdle } from '~/lib/server/hurdles';
import { HurdleTable } from '~/lib/chess-database';

interface HurdleReviewProps {
  onSelectHurdle: (hurdle: HurdleTable) => void;
}

export function HurdleReview({ onSelectHurdle }: HurdleReviewProps) {
  const [hurdles, setHurdles] = useState<HurdleTable[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getUserHurdles().then(setHurdles).finally(() => setLoading(false));
  }, []);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this hurdle?')) {
      try {
        await deleteHurdle({ data: id });
        setHurdles(prev => prev.filter(h => h.id !== id));
      } catch (error) {
        console.error('Failed to delete hurdle:', error);
        alert('Failed to delete hurdle');
      }
    }
  };

  if (loading) return <div>Loading hurdles...</div>;

  return (
    <div className="p-4 border rounded bg-gray-50 mt-4">
      <h3>Hurdles to Review</h3>
      {hurdles.length === 0 ? <p>No hurdles found.</p> : (
        <ul className="list-disc pl-5">
          {hurdles.map(hurdle => (
            <li key={hurdle.id} className="mb-2 flex items-start justify-between group">
              <button
                onClick={() => onSelectHurdle(hurdle)}
                className="text-left hover:bg-gray-100 p-1 rounded flex-grow"
              >
                <strong>{hurdle.title}</strong>
                <br />
                <span className="text-sm text-gray-700">{hurdle.ai_description}</span>
                <br />
                <span className="text-xs text-gray-500">Played: {hurdle.played_move} | Best: {hurdle.best_move} | Loss: {hurdle.centipawn_loss}</span>
              </button>
              <button
                onClick={(e) => handleDelete(e, hurdle.id)}
                className="ml-2 text-red-500 hover:text-red-700 px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Delete Hurdle"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
