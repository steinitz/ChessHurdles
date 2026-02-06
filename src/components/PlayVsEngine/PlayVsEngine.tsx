import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Chess } from 'chess.js';
import { ChessBoard } from '../ChessBoard';
import { stockfishLevelToElo, calculateNewElo } from '~/lib/elo-utils';
import { useNavigate } from '@tanstack/react-router';
import { ChessClockDisplay } from './ChessClockDisplay';
import { useSession } from '~stzUser/lib/auth-client';
import { getUserStats, updateUserStats, savePlayedGame } from '~/lib/chess-server';
import { useGameClock } from './useGameClock';
import { useStockfishEngine } from './useStockfishEngine';

// Helper to clone game state while preserving full history
function cloneGame(game: Chess): Chess {
  const newGame = new Chess();
  try {
    newGame.loadPgn(game.pgn());
  } catch (e) {
    console.error('Failed to clone game via PGN:', e);
    return new Chess(game.fen());
  }
  return newGame;
}

export function PlayVsEngine() {
  const navigate = useNavigate();
  const [game, setGame] = useState(() => new Chess());
  const [zenMode, setZenMode] = useState(false);
  const [userSide, setUserSide] = useState<'w' | 'b'>('w');
  const [userElo, setUserElo] = useState(1200);
  const [engineLevel, setEngineLevel] = useState(5);

  // Game State
  const [gameResult, setGameResult] = useState<{ winner: 'White' | 'Black' | 'Draw', reason: string } | null>(null);
  const [savedGameId, setSavedGameId] = useState<string | null>(null);
  const [showAbandonConfirm, setShowAbandonConfirm] = useState(false);
  const [showResignConfirm, setShowResignConfirm] = useState(false);
  const processedRef = useRef(false);

  const isGameActive = !gameResult && game.history().length > 0;

  // Constants
  const INITIAL_TIME_MS = 30 * 60 * 1000;
  const INCREMENT_MS = 20 * 1000;

  // -- HOOKS --

  // 1. Clock Hook
  const {
    whiteTime,
    blackTime,
    resetTimers,
    addIncrement
  } = useGameClock(game, {
    initialTimeMs: INITIAL_TIME_MS,
    incrementMs: INCREMENT_MS,
    onTimeout: (winner) => {
      setGameResult({ winner, reason: 'Timeout' });
    }
  });

  // 2. Engine Hook
  // We need to define onEngineMove before passing it to avoid circular deps if defined inline,
  // but useCallback is enough.
  const onEngineMove = useCallback(({ from, to, promotion }: { from: string; to: string; promotion?: string }) => {
    setGame(prev => {
      const next = cloneGame(prev);
      try {
        next.move({ from, to, promotion: promotion || 'q' });
        // Engine played (opposite of user usually, but logic handles sides)
        // If engine plays Black, add Black increment. If White, add White.
        // Actually, we should check turn. Engine just played, so it WAS engine's turn.
        // If userSide is White, Engine is Black. Engine played -> Add to Black.
        if (userSide === 'w') addIncrement('b');
        else addIncrement('w');
      } catch (e) {
        console.error('Failed to apply engine move:', from, to, e);
      }
      return next;
    });
  }, [userSide, addIncrement]);

  const {
    lastMoveSource,
    resetEngineState
  } = useStockfishEngine({
    userSide,
    engineLevel,
    initialTimeMs: INITIAL_TIME_MS,
    incrementMs: INCREMENT_MS,
    onMove: onEngineMove,
    game,
    isGameActive: !gameResult // Engine should stop if game result is set
  });

  // -- Game Lifecycle --

  // Auth & Stats
  const { data: session } = useSession();
  const userId = session?.user.id;

  // Fetch User Stats
  useEffect(() => {
    if (userId) {
      getUserStats()
        .then(stats => setUserElo(stats.elo))
        .catch(console.error);
    }
  }, [userId]);

  // Handle Game Over persistence
  useEffect(() => {
    if (gameResult && userId && !processedRef.current) {
      processedRef.current = true;

      const engineElo = stockfishLevelToElo(engineLevel);
      let score: 0 | 0.5 | 1 = 0;
      if (gameResult.winner === 'White') score = 1;
      else if (gameResult.winner === 'Draw') score = 0.5;

      const newElo = calculateNewElo(userElo, engineElo, score);
      const delta = newElo - userElo;

      // Update Database
      Promise.all([
        updateUserStats({
          data: { elo: newElo }
        }),
        savePlayedGame({
          data: {
            pgn: game.pgn(),
            game_type: 'game',
            difficulty_rating: engineElo,
            is_favorite: false,
            title: `Vs Stockfish (Level ${engineLevel})`,
            description: `Result: ${gameResult.winner} (${gameResult.reason}). Elo: ${userElo} -> ${newElo} (${delta > 0 ? '+' : ''}${delta})`,
            tags: JSON.stringify({ engineLevel, result: gameResult.winner })
          }
        })
      ]).then(([_stats, savedGame]) => {
        if (savedGame && savedGame.id) {
          setSavedGameId(savedGame.id);
        }
        setUserElo(newElo);
        console.log('Game saved and Elo updated');
      }).catch(err => console.error('Failed to save game:', err));
    }
  }, [gameResult, userId, userElo, engineLevel, game]);

  // Reset processed flag on new game result clear
  useEffect(() => {
    if (!gameResult) processedRef.current = false;
  }, [gameResult]);

  // Check generic Game Over (Checkmate, Draw)
  useEffect(() => {
    if (game.isGameOver() && !gameResult) {
      if (game.isCheckmate()) {
        const winner = game.turn() === 'w' ? 'Black' : 'White';
        setGameResult({ winner, reason: 'Checkmate' });
      } else if (game.isDraw()) {
        setGameResult({ winner: 'Draw', reason: 'Draw' });
      }
    }
  }, [game, gameResult]);

  // -- Handlers --

  const startNewGame = useCallback((overrideSide?: 'w' | 'b') => {
    setGame(new Chess());
    resetTimers();
    resetEngineState();
    setGameResult(null);
    setSavedGameId(null);
    setShowAbandonConfirm(false);

    if (overrideSide) {
      setUserSide(overrideSide);
    }
  }, [resetTimers, resetEngineState]);

  const onMove = useCallback((moveSan: string) => {
    // Only allow move if it's user's turn
    if (game.turn() !== userSide || gameResult) return;

    setGame((prevGame) => {
      try {
        const newGame = cloneGame(prevGame);
        const result = newGame.move(moveSan);
        if (result) {
          // User moved. Add increment to User's time.
          // If User is White, add to White.
          if (userSide === 'w') addIncrement('w');
          else addIncrement('b');
          return newGame;
        }
        return prevGame;
      } catch (e) {
        return prevGame;
      }
    });
  }, [game, gameResult, userSide, addIncrement]);

  const toggleZenMode = () => setZenMode(!zenMode);

  // Zen Mode Styles
  useEffect(() => {
    if (zenMode) {
      const originalMargin = document.body.style.margin;
      const originalOverflow = document.body.style.overflow;
      const originalPadding = document.body.style.padding;
      document.body.style.margin = '0';
      document.body.style.overflow = 'hidden';
      document.body.style.padding = '0';
      return () => {
        document.body.style.margin = originalMargin;
        document.body.style.overflow = originalOverflow;
        document.body.style.padding = originalPadding;
      };
    }
  }, [zenMode]);

  const zenModeStyles: React.CSSProperties = {
    position: 'fixed',
    top: 0, right: 0, bottom: 0, left: 0,
    width: '100vw', height: '100dvh',
    zIndex: 100, backgroundColor: 'var(--color-bg-primary)',
    display: 'flex', margin: 0, flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', padding: 0,
  };

  const containerStyles: React.CSSProperties = zenMode ? zenModeStyles : {
    display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', padding: '20px'
  };

  const boardSize = zenMode ? '100vmin' : '60vh';

  return (
    <div style={containerStyles}>
      {/* Top Row: Engine Info (Left) and Engine Clock (Right) */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        width: boardSize,
        marginBottom: '10px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h2 style={{ margin: 0, fontSize: zenMode ? '1.2rem' : '1.5rem', opacity: zenMode ? 0.7 : 1 }}>
            {!zenMode && "Play vs Stockfish"}
            {lastMoveSource && (
              <small style={{ marginLeft: '8px', fontWeight: 'normal', opacity: 0.8 }}>
                {lastMoveSource === 'Book' ? '(Book Move)' : `(Engine Lvl ${engineLevel})`}
              </small>
            )}
          </h2>
        </div>

        <ChessClockDisplay
          timeMs={blackTime}
          isActive={game.turn() === 'b' && !gameResult}
          side="Black"
        />
      </div>

      <div style={{ position: 'relative' }}>
        <ChessBoard
          game={game}
          onMove={onMove}
          boardSize={boardSize}
          showCoordinates={true}
          boardOrientation={userSide === 'w' ? 'white' : 'black'}
        />

        {/* Abandon Game Confirmation Modal */}
        {showAbandonConfirm && (
          <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', zIndex: 20 }}>
            <h3>Abandon current game?</h3>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button onClick={() => startNewGame(userSide)} style={{ backgroundColor: 'var(--color-error)' }}>Yes, Abandon</button>
              <button onClick={() => setShowAbandonConfirm(false)}>Cancel</button>
            </div>
          </div>
        )}

        {/* Resign Confirmation Modal */}
        {showResignConfirm && (
          <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', zIndex: 20 }}>
            <h3>Resign this game?</h3>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={() => {
                  setGameResult({ winner: 'Black', reason: 'Resignation' });
                  setShowResignConfirm(false);
                }}
                style={{ backgroundColor: 'var(--color-error)' }}
              >Yes, Resign</button>
              <button onClick={() => setShowResignConfirm(false)}>Cancel</button>
            </div>
          </div>
        )}

        {/* Game Over Overlay */}
        {gameResult && (
          <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', zIndex: 10 }}>
            <h2>Game Over</h2>
            <div style={{ fontSize: '1.25rem' }}>
              {gameResult.winner === 'Draw' ? 'Draw' : `${gameResult.winner} wins`} by {gameResult.reason}
            </div>
            <button onClick={() => startNewGame(userSide)}>New Game</button>
            {savedGameId ? (
              <button onClick={() => navigate({ to: '/analysis', search: { gameId: savedGameId ?? undefined, autoAnalyze: true } })}>Analyze Game</button>
            ) : (
              !session?.user && (
                <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                  <p style={{ fontSize: '0.875rem' }}>Sign in to save and analyze your games</p>
                  <a href="/auth/signin">Sign In</a>
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* Bottom Row: Action Buttons (Left) and User Clock (Right) */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        width: boardSize,
        marginTop: '10px'
      }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          {/* Side Toggle */}
          {!zenMode && !isGameActive && (
            <button
              onClick={() => startNewGame(userSide === 'w' ? 'b' : 'w')}
              style={{ padding: '0.4rem 0.8rem' }}
              title="Switch Side"
            >
              {userSide === 'w' ? <i className="fas fa-chess-king" /> : <i className="fas fa-chess-pawn" />}
              {userSide === 'w' ? " Play as Black" : " Play as White"}
            </button>
          )}

          <button
            onClick={() => {
              if (isGameActive) {
                setShowAbandonConfirm(true);
              } else {
                startNewGame(userSide);
              }
            }}
            title={isGameActive ? "Abandon Game" : "New Game"}
            style={{ padding: '0.4rem 0.8rem' }}
          >
            {isGameActive ? <i className="fas fa-times-circle" /> : <i className="fas fa-redo" />}
            {isGameActive ? " Abandon" : " New Game"}
          </button>

          <button
            onClick={() => setShowResignConfirm(true)}
            disabled={!!gameResult}
            title="Resign"
            style={{ padding: '0.4rem 0.8rem' }}
          >
            <i className="fas fa-flag" /> Resign
          </button>

          <button
            onClick={toggleZenMode}
            title={zenMode ? "Exit Zen Mode" : "Enter Zen Mode"}
            style={{ padding: '0.4rem 0.8rem' }}
          >
            {zenMode ? <i className="fas fa-compress" /> : <i className="fas fa-expand" />}
            {zenMode ? " Exit" : " Zen Mode"}
          </button>
        </div>

        <ChessClockDisplay
          timeMs={whiteTime}
          isActive={game.turn() === 'w' && !gameResult}
          side="White"
          isLowTime={whiteTime < 60000}
        />
      </div>

      {!zenMode && session?.user?.role === 'admin' && (
        <div style={{ marginTop: '1rem', padding: '1rem', border: '1px solid var(--color-bg-secondary)' }}>
          <h3>Debug Controls (Phase 2)</h3>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Difficulty (0-20):
            <input
              type="range"
              min="0"
              max="20"
              value={engineLevel}
              onChange={(e) => setEngineLevel(parseInt(e.target.value))}
            />
            {engineLevel}
          </label>
          <div style={{ marginTop: '0.5rem', fontSize: '0.75rem' }}>
            User Elo: {userElo} (Default)
          </div>
          <button onClick={() => setGameResult({ winner: 'White', reason: 'Claimed (Debug)' })}>Debug: Claim Win</button>
        </div>
      )}
    </div>
  );
}
