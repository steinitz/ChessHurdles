import React, { useEffect, useState } from 'react';
import { getUserGames, deleteGameById } from '~/lib/server/games';
import { GameTable } from '~/lib/chess-database';

export function GameList() {
  const [games, setGames] = useState<GameTable[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getUserGames().then(setGames).finally(() => setLoading(false));
  }, []);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    if (confirm('Are you sure you want to delete this game? This will also delete all associated hurdles.')) {
      try {
        await deleteGameById({ data: id });
        setGames(prev => prev.filter(g => g.id !== id));
      } catch (error) {
        console.error('Failed to delete game:', error);
        alert('Failed to delete game');
      }
    }
  };

  if (loading) return <div>Loading games...</div>;

  const REFERENCE_GAMES = [
    {
      id: 'kasparov-topalov-1999',
      title: 'Kasparov vs Topalov, Wijk aan Zee 1999',
      description: "Kasparov's Immortal",
      created_at: '1999-01-20',
      link: '/'
    }
  ];

  return (
    <div className="p-4 border rounded bg-gray-50 mt-4">
      <h3>Reference Games</h3>
      <ul className="list-disc pl-5 mb-4">
        {REFERENCE_GAMES.map(game => (
          <li key={game.id} className="mb-2">
            <div className="flex justify-between items-center">
              <div>
                <strong>
                  <a href={game.link} className="text-blue-600 hover:underline">
                    {game.title}
                  </a>
                </strong>
                {' '}- {new Date(game.created_at).toLocaleDateString()}
                <br />
                <span className="text-sm text-gray-600">{game.description}</span>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <h3>Saved Games</h3>
      {games.length === 0 ? <p style={{ color: 'var(--color-text-secondary)' }}>No saved games.</p> : (
        <ul className="list-disc pl-5">
          {games.map(game => (
            <li key={game.id} className="mb-2">
              <div className="flex justify-between items-center group">
                <div>
                  <strong>
                    <a href={`/?gameId=${game.id}`} className="text-blue-600 hover:underline">
                      {game.title}
                    </a>
                  </strong>
                  {' '}- {new Date(game.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  <br />
                  <span className="text-sm text-gray-600">{game.description}</span>
                </div>
                <button
                  onClick={(e) => handleDelete(e, game.id)}
                  className="ml-2 text-red-500 hover:text-red-700 px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Delete Game"
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
