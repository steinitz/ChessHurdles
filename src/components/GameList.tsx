import React, { useEffect, useState } from 'react';
import { getUserGames } from '~/lib/server/games';
import { GameTable } from '~/lib/chess-database';

export function GameList() {
  const [games, setGames] = useState<GameTable[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getUserGames().then(setGames).finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading games...</div>;

  return (
    <div className="p-4 border rounded bg-gray-50 mt-4">
      <h3>Saved Games</h3>
      {games.length === 0 ? <p>No saved games.</p> : (
        <ul className="list-disc pl-5">
          {games.map(game => (
            <li key={game.id}>
              <strong>{game.title}</strong> - {new Date(game.created_at).toLocaleDateString()}
              <br />
              <span className="text-sm text-gray-600">{game.description}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
