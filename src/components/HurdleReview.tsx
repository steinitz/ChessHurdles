import React, { useEffect, useState } from 'react';
import { getUserHurdles } from '~/lib/server/hurdles';
import { HurdleTable } from '~/lib/chess-database';

export function HurdleReview() {
  const [hurdles, setHurdles] = useState<HurdleTable[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getUserHurdles().then(setHurdles).finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading hurdles...</div>;

  return (
    <div className="p-4 border rounded bg-gray-50 mt-4">
      <h3>Hurdles to Review</h3>
      {hurdles.length === 0 ? <p>No hurdles found.</p> : (
        <ul className="list-disc pl-5">
          {hurdles.map(hurdle => (
            <li key={hurdle.id} className="mb-2">
              <strong>{hurdle.title}</strong> (Move {hurdle.move_number})
              <br />
              <span className="text-sm text-gray-700">{hurdle.ai_description}</span>
              <br />
              <span className="text-xs text-gray-500">Played: {hurdle.played_move} | Best: {hurdle.best_move} | Loss: {hurdle.centipawn_loss}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
