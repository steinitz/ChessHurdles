import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Chess } from 'chess.js';
import { ChessBoard } from '../ChessBoard';
import { initializeStockfishWorker, type EngineOptions } from '~/lib/stockfish-engine';
import { eloToStockfishLevel, stockfishLevelToElo, calculateNewElo } from '~/lib/elo-utils';
import { ChessClockDisplay } from './ChessClockDisplay';
import { useSession } from '~stzUser/lib/auth-client';
import { getUserStats, updateUserStats, savePlayedGame } from '~/lib/chess-server';

export function PlayVsEngine() {
  const [game, setGame] = useState(() => new Chess());
  const [zenMode, setZenMode] = useState(false);
  const [userElo, setUserElo] = useState(1200); // Default, will fetch later
  const [engineLevel, setEngineLevel] = useState(5); // ~1350 Elo
  const [isEngineThinking, setIsEngineThinking] = useState(false);

  // Clock State (30m + 20s increment)
  const INITIAL_TIME_MS = 30 * 60 * 1000;
  const INCREMENT_MS = 20 * 1000;
  const [whiteTime, setWhiteTime] = useState(INITIAL_TIME_MS);
  const [blackTime, setBlackTime] = useState(INITIAL_TIME_MS);
  const [lastTick, setLastTick] = useState<number | null>(null);
  const [gameResult, setGameResult] = useState<{ winner: 'White' | 'Black' | 'Draw', reason: string } | null>(null);
  const processedRef = useRef(false);

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
          data: {
            elo: newElo,
            // Simple increment if we wanted to track wins strictly, but Elo is the main thing here
          }
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
      ]).then(() => {
        setUserElo(newElo);
        console.log('Game saved and Elo updated');
      }).catch(err => console.error('Failed to save game:', err));
    }
  }, [gameResult, userId, userElo, engineLevel, game]);

  // Reset processed flag on new game
  useEffect(() => {
    if (!gameResult) processedRef.current = false;
  }, [gameResult]);

  const engineWorkerRef = useRef<Worker | null>(null);

  // Initialize Engine
  useEffect(() => {
    if (!engineWorkerRef.current) {
      engineWorkerRef.current = initializeStockfishWorker(
        (event) => {
          const msg = event.data;
          // Parse bestmove
          if (typeof msg === 'string' && msg.startsWith('bestmove')) {
            // msg format: "bestmove e2e4 ponder ..."
            const moves = msg.split(' ');
            const bestMove = moves[1];
            if (bestMove) {
              console.log('Engine played:', bestMove);
              // Apply move
              setGame(prev => {
                const next = new Chess(prev.fen());
                try {
                  // bestMove is UCI (e.g. e2e4), chess.js needs object for promotion usually, or robust SAN parser
                  // safest is {from, to, promotion}
                  const from = bestMove.substring(0, 2);
                  const to = bestMove.substring(2, 4);
                  const promotion = bestMove.length > 4 ? bestMove.substring(4, 5) : undefined;
                  next.move({ from, to, promotion: promotion || 'q' });
                  // Add increment for Black
                  setBlackTime(t => t + INCREMENT_MS);
                } catch (e) {
                  console.error('Failed to apply engine move:', bestMove, e);
                }
                return next;
              });
              setIsEngineThinking(false);
            }
          }
        },
        (err) => console.error('Engine error:', err),
        {
          "Skill Level": engineLevel,
          "Use NNUE": "true" // Ensure strong eval base, though Skill Level adds noise
        }
      );
    }

    return () => {
      if (engineWorkerRef.current) {
        engineWorkerRef.current.terminate();
        engineWorkerRef.current = null;
      }
    };
  }, []);

  // Timer Effect
  useEffect(() => {
    if (game.isGameOver() || gameResult) return;

    const timer = setInterval(() => {
      const now = Date.now();
      const delta = lastTick ? now - lastTick : 0;
      setLastTick(now);

      if (delta > 0) {
        if (game.turn() === 'w') {
          setWhiteTime(prev => {
            const next = prev - delta;
            if (next <= 0) {
              setGameResult({ winner: 'Black', reason: 'Timeout' });
              return 0;
            }
            return next;
          });
        } else {
          setBlackTime(prev => {
            const next = prev - delta;
            if (next <= 0) {
              setGameResult({ winner: 'White', reason: 'Timeout' });
              return 0;
            }
            return next;
          });
        }
      }
    }, 100);

    return () => clearInterval(timer);
  }, [game.turn(), game.isGameOver(), lastTick, gameResult]);

  // Reset lastTick on turn change to separate move times accurately
  useEffect(() => {
    setLastTick(Date.now());
  }, [game.turn()]);

  // Check generic Game Over (Mate, Draw)
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

  // Update Skill Level when it changes
  useEffect(() => {
    if (engineWorkerRef.current) {
      engineWorkerRef.current.postMessage(`setoption name Skill Level value ${engineLevel}`);
    }
  }, [engineLevel]);

  // Trigger Engine Logic
  useEffect(() => {
    // If it's engine's turn and game is not over
    if (game.turn() === 'b' && !game.isGameOver() && !isEngineThinking && engineWorkerRef.current) {
      setIsEngineThinking(true);
      // Small delay for realism
      setTimeout(() => {
        engineWorkerRef.current?.postMessage(`position fen ${game.fen()}`);
        // Go for a fixed time or depth? 
        // For "Play vs Computer", we usually want a time limit or flexible depth.
        // Let's use movetime 1000ms for now for snappy play in Phase 2
        engineWorkerRef.current?.postMessage('go movetime 1000');
      }, 500);
    }
  }, [game, isEngineThinking]);

  const onMove = useCallback((moveSan: string) => {
    // Only allow move if it's white's turn (user)
    if (game.turn() !== 'w' || gameResult) return;

    setGame((prevGame) => {
      try {
        const newGame = new Chess(prevGame.fen());
        const result = newGame.move(moveSan);
        if (result) {
          // Add increment for White
          setWhiteTime(t => t + INCREMENT_MS);
          return newGame;
        }
        return prevGame;
      } catch (e) {
        return prevGame;
      }
    });
  }, [game, gameResult]);

  const toggleZenMode = () => setZenMode(!zenMode);

  // Handle Body Styles for Zen Mode
  useEffect(() => {
    if (zenMode) {
      // Save original styles
      const originalMargin = document.body.style.margin;
      const originalOverflow = document.body.style.overflow;
      const originalPadding = document.body.style.padding;

      // Apply Zen styles
      document.body.style.margin = '0';
      document.body.style.overflow = 'hidden';
      document.body.style.padding = '0';

      return () => {
        // Restore
        document.body.style.margin = originalMargin;
        document.body.style.overflow = originalOverflow;
        document.body.style.padding = originalPadding;
      };
    }
  }, [zenMode]);

  // Styles for Zen Mode to overlay everything
  const zenModeStyles: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100vw',
    height: '100dvh', // Dynamic viewport height for mobile browsers
    zIndex: 100,
    backgroundColor: 'var(--color-bg-primary)',
    display: 'flex',
    margin: 0,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  };

  const containerStyles: React.CSSProperties = zenMode ? zenModeStyles : {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: '100%',
    padding: '20px'
  };

  const boardSize = zenMode ? '100vmin' : '60vh';

  return (
    <div style={containerStyles}>
      {/* HUD Bar */}
      <div className="flex justify-between w-full max-w-2xl mb-4 items-center" style={{ width: zenMode ? '90vmin' : '60vh' }}>
        {/* Left Side: Stats / Engine Info */}
        <div className="flex flex-col">
          <h2 className={zenMode ? 'text-sm opacity-50' : 'text-xl font-bold'}>
            {!zenMode && "Play vs Stockfish"}
          </h2>
          {/* Engine Clock */}
          <div className="mt-1">
            <ChessClockDisplay
              timeMs={blackTime}
              isActive={game.turn() === 'b' && !gameResult}
              side="Black"
            />
          </div>
        </div>

        {/* Right Side: Controls / User Clock */}
        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (window.confirm('Are you sure you want to start a new game?')) {
                  setGame(new Chess());
                  setWhiteTime(INITIAL_TIME_MS);
                  setBlackTime(INITIAL_TIME_MS);
                  setGameResult(null);
                  setLastTick(null);
                }
              }}
              className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm flex items-center gap-2"
              title="New Game"
            >
              <i className="fas fa-redo" /> New Game
            </button>

            <button
              onClick={() => {
                if (window.confirm('Are you sure you want to resign?')) {
                  setGameResult({ winner: 'Black', reason: 'Resignation' });
                }
              }}
              disabled={!!gameResult}
              className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-sm flex items-center gap-2 disabled:opacity-50"
              title="Resign"
            >
              <i className="fas fa-flag" /> Resign
            </button>

            <button
              onClick={toggleZenMode}
              className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm flex items-center gap-2"
              title={zenMode ? "Exit Zen Mode" : "Enter Zen Mode"}
            >
              {zenMode ? <i className="fas fa-compress" /> : <i className="fas fa-expand" />}
              {zenMode ? " Exit" : " Zen Mode"}
            </button>
          </div>

          {/* User Clock */}
          <ChessClockDisplay
            timeMs={whiteTime}
            isActive={game.turn() === 'w' && !gameResult}
            side="White"
            isLowTime={whiteTime < 60000}
          />
        </div>
      </div>

      <div className="relative">
        <ChessBoard
          game={game}
          onMove={onMove}
          boardSize={boardSize}
          showCoordinates={true}
        />

        {/* Game Over Overlay */}
        {gameResult && (
          <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white rounded-lg backdrop-blur-sm z-10">
            <h2 className="text-3xl font-bold mb-2">Game Over</h2>
            <div className="text-xl mb-4">
              {gameResult.winner === 'Draw' ? 'Draw' : `${gameResult.winner} wins`} by {gameResult.reason}
            </div>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-white text-black font-bold rounded hover:scale-105 transition-transform"
            >
              New Game
            </button>
          </div>
        )}
      </div>

      {!zenMode && (
        <div className="mt-4 p-4 border rounded bg-gray-50 w-full max-w-lg">
          <h3 className="font-bold mb-2">Debug Controls (Phase 2)</h3>
          <label className="flex items-center gap-2">
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
          <div className="mt-2 text-xs text-gray-500">
            User Elo: {userElo} (Default)
          </div>
          <button
            onClick={() => setGameResult({ winner: 'White', reason: 'Claimed (Debug)' })}
            className="mt-2 text-xs bg-green-100 hover:bg-green-200 text-green-800 px-2 py-1 rounded border border-green-300"
          >
            Debug: Claim Win
          </button>
        </div>
      )}
    </div>
  );
}
