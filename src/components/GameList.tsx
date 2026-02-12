import React, { useEffect, useState } from 'react';
import { getUserGames, deleteGameById } from '~/lib/server/games';
import { GameTable } from '~/lib/chess-database';
import { formatNiceDate } from '~/lib/chess-utils';

interface GameListProps {
  initialGames?: GameTable[];
  showTitle?: boolean;
  showReferenceGames?: boolean;
}

export function GameList({
  initialGames,
  showTitle = true,
  showReferenceGames = true
}: GameListProps) {
  const [games, setGames] = useState<GameTable[]>(initialGames || []);
  const [loading, setLoading] = useState(!initialGames);

  useEffect(() => {
    if (!initialGames) {
      getUserGames()
        .then(setGames)
        .catch(err => console.log('Failed to load games (likely unauthorized):', err))
        .finally(() => setLoading(false));
    }
  }, [initialGames]);

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
    <div style={{
      padding: '1rem',
      marginTop: '1rem'
    }}>
      {showReferenceGames && (
        <>
          {showTitle && <h3>Reference Games</h3>}
          <ul style={{ listStyleType: 'disc', paddingLeft: '1.25rem', marginBottom: '1rem' }}>
            {REFERENCE_GAMES.map(game => (
              <li key={game.id} style={{ marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong>
                      <a href={game.link} style={{ color: 'var(--color-link)' }}>
                        {game.title}
                      </a>
                    </strong>
                    {' '}- {formatNiceDate(game.created_at)}
                    <br />
                    <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>{game.description}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {showTitle && <h3>Saved Games</h3>}
      {games.length === 0 ? <p style={{ color: 'var(--color-text-secondary)' }}>No saved games.</p> : (
        <ul style={{ listStyleType: 'disc', paddingLeft: '1.25rem' }}>
          {games.map(game => (
            <li key={game.id} style={{ marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>
                    <a href={`/?gameId=${game.id}`} style={{ color: 'var(--color-link)' }}>
                      {game.title || 'Untitled Game'}
                    </a>
                  </strong>
                  {' '}- {formatNiceDate(game.created_at)}
                  <br />
                  <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                    {/* New structured fields (Step 2a) */}
                    {game.result && (
                      <>
                        <strong>{game.result}</strong>
                        {game.user_elo_before !== null && game.user_elo_after !== null && ' • '}
                      </>
                    )}
                    {game.user_elo_before !== null && game.user_elo_after !== null && (
                      <span>Elo: {game.user_elo_before} → {game.user_elo_after}</span>
                    )}
                    {/* Fallback for old games with only description */}
                    {!game.result && game.description && (
                      <span>{game.description.replace(/\s*\((White|Black|Draw)\)/g, '').replace(/\.\s*Elo:/, '\u00A0Elo:')}</span>
                    )}
                  </span>
                </div>
                <button
                  onClick={(e) => handleDelete(e, game.id)}
                  style={{
                    marginLeft: '0.5rem',
                    color: '#ef4444',
                    padding: '0.25rem 0.5rem',
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer'
                  }}
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
