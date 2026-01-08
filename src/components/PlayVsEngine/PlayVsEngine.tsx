import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Chess } from 'chess.js';
import { ChessBoard } from '../ChessBoard';
import { initializeStockfishWorker, type EngineOptions } from '~/lib/stockfish-engine';
import { eloToStockfishLevel, stockfishLevelToElo, calculateNewElo } from '~/lib/elo-utils';
import { getOpeningMove, getBookMoveDelay } from '~/lib/opening-book';
import { ChessClockDisplay } from './ChessClockDisplay';
import { useSession } from '~stzUser/lib/auth-client';
import { getUserStats, updateUserStats, savePlayedGame } from '~/lib/chess-server';

import { useNavigate } from '@tanstack/react-router';

// Helper to clone game state while preserving full history
function cloneGame(game: Chess): Chess {
  const newGame = new Chess();
  try {
    newGame.loadPgn(game.pgn());
    // Also copy headers directly if needed, but loadPgn usually handles it
    // If PGN is empty (start), newGame is already correct
  } catch (e) {
    console.error('Failed to clone game via PGN:', e);
    // Fallback to FEN if PGN fails (loses history but keeps position)
    return new Chess(game.fen());
  }
  return newGame;
}

export function PlayVsEngine() {
  const navigate = useNavigate();
  const [game, setGame] = useState(() => new Chess());
  const [zenMode, setZenMode] = useState(false);
  const [userElo, setUserElo] = useState(1200); // Default, will fetch later
  const [engineLevel, setEngineLevel] = useState(5); // ~1350 Elo
  const [isEngineThinking, setIsEngineThinking] = useState(false);
  const [isOutOfBook, setIsOutOfBook] = useState(false);
  const [lastMoveSource, setLastMoveSource] = useState<'Book' | 'Engine' | null>(null);

  // Clock State (30m + 20s increment)
  const INITIAL_TIME_MS = 30 * 60 * 1000;
  const INCREMENT_MS = 20 * 1000;
  const [whiteTime, setWhiteTime] = useState(INITIAL_TIME_MS);
  const [blackTime, setBlackTime] = useState(INITIAL_TIME_MS);
  const [lastTick, setLastTick] = useState<number | null>(null);
  const [gameResult, setGameResult] = useState<{ winner: 'White' | 'Black' | 'Draw', reason: string } | null>(null);
  const [savedGameId, setSavedGameId] = useState<string | null>(null);
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

      ]).then(([_stats, savedGame]) => {
        if (savedGame && savedGame.id) {
          setSavedGameId(savedGame.id);
        }
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
                const next = cloneGame(prev);
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
    // Only run timer if game is in progress AND at least one move has been made
    if (game.isGameOver() || gameResult || game.history().length === 0) return;

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

  // Trigger Engine / Book Logic
  useEffect(() => {
    // If it's black's turn and game is not over and not thinking
    if (game.turn() === 'b' && !game.isGameOver() && !isEngineThinking && engineWorkerRef.current) {
      setIsEngineThinking(true);

      const makeEngineMove = () => {
        setLastMoveSource('Engine');
        engineWorkerRef.current?.postMessage(`position fen ${game.fen()}`);
        engineWorkerRef.current?.postMessage('go movetime 1000');
      };

      const tryBookMove = async () => {
        // Calculate delay
        const delay = getBookMoveDelay(INITIAL_TIME_MS, INCREMENT_MS);

        // Wait first
        await new Promise(resolve => setTimeout(resolve, delay));

        // Check verification (double check turn hasn't changed)
        if (game.turn() !== 'b' || game.isGameOver()) {
          setIsEngineThinking(false);
          return;
        }

        const bookMoveUci = await getOpeningMove(game.fen());

        if (bookMoveUci) {
          console.log('Playing Book Move:', bookMoveUci);
          setLastMoveSource('Book');

          setGame(prev => {
            const next = cloneGame(prev);
            try {
              const from = bookMoveUci.substring(0, 2);
              const to = bookMoveUci.substring(2, 4);
              const promotion = bookMoveUci.length > 4 ? bookMoveUci.substring(4, 5) : undefined;

              next.move({ from, to, promotion: promotion || 'q' });
              setBlackTime(t => t + INCREMENT_MS);
            } catch (e) {
              console.error('Failed to apply book move:', bookMoveUci);
              // Fallback to engine if book move is invalid (unlikely)
              makeEngineMove();
              return next; // Wait for engine to reply
            }
            return next;
          });
          setIsEngineThinking(false);
        } else {
          console.log('Out of Book');
          setIsOutOfBook(true);
          makeEngineMove();
        }
      };

      if (!isOutOfBook) {
        tryBookMove();
      } else {
        // Engine Move
        // Small delay for realism if it's engine
        setTimeout(makeEngineMove, 500);
      }
    }
  }, [game, isEngineThinking, isOutOfBook]);

  const onMove = useCallback((moveSan: string) => {
    // Only allow move if it's white's turn (user)
    if (game.turn() !== 'w' || gameResult) return;

    setGame((prevGame) => {
      try {
        const newGame = cloneGame(prevGame);
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

  const startNewGame = useCallback(() => {
    setGame(new Chess());
    setWhiteTime(INITIAL_TIME_MS);
    setBlackTime(INITIAL_TIME_MS);
    setGameResult(null);
    setSavedGameId(null);
    setLastTick(null);
    setIsOutOfBook(false);
    setLastMoveSource(null);
    setShowAbandonConfirm(false);
  }, []);

  const [showAbandonConfirm, setShowAbandonConfirm] = useState(false);
  const [showResignConfirm, setShowResignConfirm] = useState(false);
  const isGameActive = !gameResult && game.history().length > 0;

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
              <small style={{
                marginLeft: '8px',
                fontWeight: 'normal',
                opacity: 0.8
              }}>
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
        />

        {/* Abandon Game Confirmation Modal */}
        {showAbandonConfirm && (
          <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', zIndex: 20 }}>
            <h3>Abandon current game?</h3>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={startNewGame}
                style={{ backgroundColor: 'var(--color-error)' }}
              >
                Yes, Abandon
              </button>
              <button
                onClick={() => setShowAbandonConfirm(false)}
              >
                Cancel
              </button>
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
              >
                Yes, Resign
              </button>
              <button
                onClick={() => setShowResignConfirm(false)}
              >
                Cancel
              </button>
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
            <button
              onClick={startNewGame}
            >
              New Game
            </button>
            {savedGameId ? (
              <button
                onClick={() => navigate({ to: '/analysis', search: { gameId: savedGameId ?? undefined, autoAnalyze: true } })}
              >
                Analyze Game
              </button>
            ) : (
              !session?.user && (
                <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                  <p style={{ fontSize: '0.875rem' }}>Sign in to save and analyze your games</p>
                  <a href="/auth/signin">
                    Sign In
                  </a>
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
          <button
            onClick={() => {
              if (isGameActive) {
                setShowAbandonConfirm(true);
              } else {
                startNewGame();
              }
            }}
            title={isGameActive ? "Abandon Game" : "New Game"}
            style={{ padding: '0.4rem 0.8rem' }}
          >
            {isGameActive ? <i className="fas fa-times-circle" /> : <i className="fas fa-redo" />}
            {isGameActive ? " Abandon" : " New Game"}
          </button>

          <button
            onClick={() => {
              setShowResignConfirm(true);
            }}
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

      {!zenMode && (
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
          <button
            onClick={() => setGameResult({ winner: 'White', reason: 'Claimed (Debug)' })}
          >
            Debug: Claim Win
          </button>
        </div>
      )}
    </div>
  );
}
