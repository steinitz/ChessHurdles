import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Chess } from 'chess.js';
import { ChessBoard } from '../ChessBoard';
import { stockfishLevelToElo, eloToStockfishLevel, calculateNewElo } from '~/lib/elo-utils';
import { clientEnv } from '~/lib/env.app';
import { useNavigate } from '@tanstack/react-router';
import { ChessClockDisplay } from './ChessClockDisplay';
import { useSession } from '~stzUser/lib/auth-client';
import { getUserStats, updateUserStats, savePlayedGame } from '~/lib/chess-server';
import { useGameClock } from './useGameClock';
import { useStockfishEngine } from './useStockfishEngine';
import { Dialog, type DialogRefType, makeDialogRef } from '../../../stzUtils/components/Dialog';
import * as v from 'valibot';

// Validation Schema
const TimeControlSchema = v.object({
  timeMinutes: v.pipe(v.number(), v.minValue(0.1, 'Time must be at least 0.1 minutes')),
  incrementSeconds: v.pipe(v.number(), v.minValue(0, 'Increment cannot be negative')),
});

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

  // -- Zen Mode (Persisted) --
  const [zenMode, setZenMode] = useState(() => {
    try {
      return localStorage.getItem('chess_zen_mode') === 'true';
    } catch { return false; }
  });

  const [userSide, setUserSide] = useState<'w' | 'b'>('w');
  const [userElo, setUserElo] = useState(1200);
  const [engineLevel, setEngineLevel] = useState(2);

  // Adaptive Difficulty: Adjust engine level based on User Elo - Muzzle
  useEffect(() => {
    if (userElo > 0) {
      const targetElo = Math.max(0, userElo - clientEnv.ENGINE_ELO_MUZZLE);
      const recommended = eloToStockfishLevel(targetElo);
      setEngineLevel(recommended);
    }
  }, [userElo]);

  // -- Time Control Configuration (Persisted) --
  // Default: 30m + 20s
  const DEFAULT_CONFIG = { time: 30 * 60 * 1000, inc: 20 * 1000 };
  const [userTimeConfig, setUserTimeConfig] = useState(DEFAULT_CONFIG);
  const [engineTimeConfig, setEngineTimeConfig] = useState(DEFAULT_CONFIG);

  // Load from LocalStorage on mount (Time controls)
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('chess_time_user');
      const storedEngine = localStorage.getItem('chess_time_engine');
      if (storedUser) setUserTimeConfig(JSON.parse(storedUser));
      if (storedEngine) setEngineTimeConfig(JSON.parse(storedEngine));
    } catch (e) {
      console.error('Failed to load time config', e);
    }
  }, []);

  // Save Config Helpers
  const saveUserConfig = (config: typeof DEFAULT_CONFIG) => {
    setUserTimeConfig(config);
    localStorage.setItem('chess_time_user', JSON.stringify(config));
  };
  const saveEngineConfig = (config: typeof DEFAULT_CONFIG) => {
    setEngineTimeConfig(config);
    localStorage.setItem('chess_time_engine', JSON.stringify(config));
  };

  // Determine current effective settings based on side
  const whiteConfig = userSide === 'w' ? userTimeConfig : engineTimeConfig;
  const blackConfig = userSide === 'b' ? userTimeConfig : engineTimeConfig;

  // Game State
  const [gameResult, setGameResult] = useState<{ winner: 'White' | 'Black' | 'Draw', reason: string } | null>(null);
  const [savedGameId, setSavedGameId] = useState<string | null>(null);
  const [showAbandonConfirm, setShowAbandonConfirm] = useState(false);
  const [showResignConfirm, setShowResignConfirm] = useState(false);
  const processedRef = useRef(false);

  // Auth & Stats
  const { data: session } = useSession();
  const userId = session?.user.id;

  const isGameActive = !gameResult && (game.history().length > 0 || (userSide === 'b' && game.history().length === 0));

  // -- HOOKS --

  // 1. Clock Hook
  const {
    whiteTime,
    blackTime,
    resetTimers,
    addIncrement,
    setWhiteTime,
    setBlackTime
  } = useGameClock(game, {
    whiteInitialTimeMs: whiteConfig.time,
    blackInitialTimeMs: blackConfig.time,
    whiteIncrementMs: whiteConfig.inc,
    blackIncrementMs: blackConfig.inc,
    userSide: userSide || 'w',
    onTimeout: (winner) => {
      setGameResult({ winner, reason: 'Timeout' });
    }
  });

  // Sync clocks when config changes (e.g. loaded from storage), but ONLY if game hasn't started
  useEffect(() => {
    if (game.history().length === 0) {
      setWhiteTime(whiteConfig.time);
      setBlackTime(blackConfig.time);
    }
  }, [userTimeConfig, engineTimeConfig, userSide, setWhiteTime, setBlackTime, game]);

  // 2. Engine Hook
  const onEngineMove = useCallback(({ from, to, promotion }: { from: string; to: string; promotion?: string }) => {
    // Guard: Ignore engine moves if game is over
    if (gameResult) {
      console.log('Ignoring engine move - game already ended');
      return;
    }

    try {
      const next = cloneGame(game);
      // Only include promotion if actually provided (fixes knight move bug)
      next.move({ from, to, ...(promotion && { promotion }) });
      setGame(next);

      // Engine played. If User is White (Engine Black), add Black increment.
      if (userSide === 'w') addIncrement('b');
      else addIncrement('w');
    } catch (e) {
      console.error('Failed to apply engine move:', from, to, e);
    }
  }, [game, userSide, addIncrement, gameResult]);

  const {
    lastMoveSource,
    resetEngineState
  } = useStockfishEngine({
    userSide,
    engineLevel,
    initialTimeMs: engineTimeConfig.time, // Used for book delay calc
    engineIncrementMs: engineTimeConfig.inc,
    onMove: onEngineMove,
    game,
    isGameActive: !gameResult
  });

  // -- Stability Hooks --

  // Wake Lock: Prevent screen sleep while game is active
  useEffect(() => {
    if (!isGameActive) return;

    let wakeLock: any = null; // Typing 'any' to avoid TS issues if WakeLock types aren't global

    const requestLock = async () => {
      try {
        if (navigator && 'wakeLock' in navigator) {
          wakeLock = await (navigator as any).wakeLock.request('screen');
        }
      } catch (err) {
        console.warn('Wake Lock request failed:', err);
      }
    };

    requestLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && wakeLock === null) {
        requestLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLock) {
        wakeLock.release().catch(console.error);
        wakeLock = null;
      }
    };
  }, [isGameActive]);

  // Keyboard Support: Enter key for primary overlay action
  useEffect(() => {
    if (!gameResult) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (gameResult.reason === 'Aborted') {
          setGame(new Chess());
          resetEngineState();
          setGameResult(null);
        } else {
          // Primary action for completed: Analyze (or Sign In if not logged in)
          if (savedGameId) {
            navigate({ to: '/analysis', search: { gameId: savedGameId, autoAnalyze: true } });
          } else if (!userId) {
            navigate({ to: '/auth/signin' });
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameResult, savedGameId, userId, navigate, resetEngineState]);

  // -- Modal State --
  const timeDialogRef = makeDialogRef();
  const [modalRole, setModalRole] = useState<'User' | 'Engine'>('User');
  const [tempTimeStr, setTempTimeStr] = useState('');
  const [tempIncStr, setTempIncStr] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);

  // -- Handlers --

  const startNewGame = useCallback((overrideSide?: 'w' | 'b') => {
    // If no override provided, toggle from current userSide (alternating games)
    const side = overrideSide || (userSide === 'w' ? 'b' : 'w');
    if (side !== userSide) setUserSide(side);

    setGame(new Chess());

    // Explicitly set times based on current configs and side
    const pWhite = side === 'w' ? userTimeConfig : engineTimeConfig;
    const pBlack = side === 'b' ? userTimeConfig : engineTimeConfig;

    setWhiteTime(pWhite.time);
    setBlackTime(pBlack.time);
    // resetTimers() would default to props, which might lag state updates, so explicit set is safer.

    resetEngineState();
    setGameResult(null);
    setSavedGameId(null);
    setShowAbandonConfirm(false);
  }, [userSide, userTimeConfig, engineTimeConfig, setWhiteTime, setBlackTime, resetEngineState]);

  // Handle Clock Click -> Open Modal
  const handleClockClick = useCallback((side: 'White' | 'Black') => {
    // Map clicked clock to Role
    let role: 'User' | 'Engine';
    if (side === 'White') {
      role = userSide === 'w' ? 'User' : 'Engine';
    } else {
      role = userSide === 'b' ? 'User' : 'Engine';
    }

    setModalRole(role);
    const config = role === 'User' ? userTimeConfig : engineTimeConfig;

    // Pre-fill inputs (Time in minutes, Inc in seconds)
    setTempTimeStr((config.time / 60000).toString());
    setTempIncStr((config.inc / 1000).toString());
    setModalError(null);

    timeDialogRef.current?.setIsOpen(true);
  }, [userSide, userTimeConfig, engineTimeConfig]);

  const saveTimeConfig = () => {
    try {
      const timeMin = parseFloat(tempTimeStr);
      const incSec = parseFloat(tempIncStr);

      const result = v.parse(TimeControlSchema, { timeMinutes: timeMin, incrementSeconds: incSec });

      const newConfig = {
        time: result.timeMinutes * 60 * 1000,
        inc: result.incrementSeconds * 1000
      };

      // Apply
      if (modalRole === 'User') saveUserConfig(newConfig);
      else saveEngineConfig(newConfig);

      // Update current running clock immediately if game hasn't really started or just to reflect change?
      // Logic: If I change White's clock while playing White, I expect White's time to update.
      // If I'm White, User = White. So User Config update -> White Time update.

      // Careful: resetting time mid-game to FULL initial time might be cheating/weird, but that's what "Set Time" usually implies.
      // Or should it only update the *config* for next game?
      // User request was "Click clock -> set custom time". Usually implies setting CURRENT time.
      // But we are editing the CONFIG.
      // Let's do both: Update config + Set current time to the new value.

      if (modalRole === 'User') {
        if (userSide === 'w') setWhiteTime(newConfig.time);
        else setBlackTime(newConfig.time);
      } else {
        if (userSide === 'w') setBlackTime(newConfig.time); // User White -> Engine Black
        else setWhiteTime(newConfig.time); // User Black -> Engine White
      }

      timeDialogRef.current?.setIsOpen(false);
    } catch (e) {
      if (e instanceof v.ValiError) {
        setModalError(e.message);
      } else {
        setModalError("Invalid input");
      }
    }
  };

  // -- Game Logic continued --

  useEffect(() => {
    if (userId) {
      getUserStats().then(stats => {
        if (stats.elo) setUserElo(stats.elo);
        if (stats.last_user_side) setUserSide(stats.last_user_side);
      }).catch(console.error);
    }
  }, [userId]);

  // Handle Game Over persistence
  useEffect(() => {
    if (gameResult && userId && !processedRef.current) {
      // Skip saving/stats if Aborted
      if (gameResult.reason === 'Aborted') {
        processedRef.current = true;
        return;
      }

      processedRef.current = true;
      const engineElo = stockfishLevelToElo(engineLevel);
      let score: 0 | 0.5 | 1 = 0;
      if (gameResult.winner === 'White') score = 1;
      else if (gameResult.winner === 'Draw') score = 0.5;

      const newElo = calculateNewElo(userElo, engineElo, score);

      // Set PGN headers before saving for data integrity
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0].replace(/-/g, '.');
      game.header(
        'Event', 'Play vs Stockfish',
        'Site', window.location.origin,
        'Date', dateStr,
        'White', userSide === 'w' ? (session?.user?.name || 'User') : `Stockfish Lvl ${engineLevel}`,
        'Black', userSide === 'b' ? (session?.user?.name || 'User') : `Stockfish Lvl ${engineLevel}`,
        'Result', score === 1 ? '1-0' : score === 0.5 ? '1/2-1/2' : '0-1',
        'UserSide', userSide || 'w'
      );

      Promise.all([
        updateUserStats({ data: { elo: newElo } }),
        savePlayedGame({
          data: {
            pgn: game.pgn(),
            game_type: 'game',
            white_id: userSide === 'w' ? userId : `stockfish-lvl-${engineLevel}`,
            black_id: userSide === 'b' ? userId : `stockfish-lvl-${engineLevel}`,
            difficulty_rating: engineElo,
            is_favorite: false,
            title: `${session?.user?.name || 'Player'} vs Stockfish Level ${engineLevel}`,
            // New structured fields (Step 1d)
            user_elo_before: userElo,
            user_elo_after: newElo,
            result: score === 1 ? '1-0' : score === 0.5 ? '1/2-1/2' : '0-1',
            // Legacy field (backwards compatibility during migration)
            description: `Result: ${score === 1 ? '1-0' : score === 0.5 ? '1/2-1/2' : '0-1'}  Elo: ${userElo} -> ${newElo}`,
            tags: JSON.stringify({ engineLevel, result: gameResult.winner })
          }
        })
      ]).then(([_stats, savedGame]) => {
        if (savedGame?.id) setSavedGameId(savedGame.id);
        setUserElo(newElo);
      }).catch(console.error);
    }
  }, [gameResult, userId, userElo, engineLevel, game]);

  useEffect(() => { if (!gameResult) processedRef.current = false; }, [gameResult]);

  useEffect(() => {
    if (game.isGameOver() && !gameResult) {
      if (game.isCheckmate()) setGameResult({ winner: game.turn() === 'w' ? 'Black' : 'White', reason: 'Checkmate' });
      else if (game.isDraw()) setGameResult({ winner: 'Draw', reason: 'Draw' });
    }
  }, [game, gameResult]);

  const onMove = useCallback((moveSan: string) => {
    if (game.turn() !== userSide || gameResult) return;
    try {
      const next = cloneGame(game);
      if (next.move(moveSan)) {
        setGame(next);
        if (userSide === 'w') addIncrement('w');
        else addIncrement('b');
      }
    } catch (e) {
      console.error('Failed to apply move:', moveSan, e);
    }
  }, [game, gameResult, userSide, addIncrement]);

  const toggleZenMode = useCallback(() => {
    setZenMode(prev => {
      const next = !prev;
      localStorage.setItem('chess_zen_mode', String(next));
      return next;
    });
  }, []);

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
                {lastMoveSource === 'Book' ? 'Book Move' : `Engine Level ${engineLevel}`}
              </small>
            )}
          </h2>
        </div>

        <ChessClockDisplay
          timeMs={userSide === 'w' ? blackTime : whiteTime}
          isActive={game.turn() === (userSide === 'w' ? 'b' : 'w') && !gameResult}
          side={userSide === 'w' ? "Black" : "White"}
          onClick={!isGameActive ? () => handleClockClick(userSide === 'w' ? 'Black' : 'White') : undefined}
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

        {/* Dialogs */}
        {showAbandonConfirm && (
          <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', zIndex: 20 }}>
            <h3>Abandon</h3>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={() => {
                  setGameResult({ winner: 'Draw', reason: 'Aborted' });
                  setShowAbandonConfirm(false);
                }}
                style={{ backgroundColor: 'var(--color-error)', borderColor: 'var(--color-error)' }}
              >
                Yes, Abandon
              </button>
              <button onClick={() => setShowAbandonConfirm(false)}>Cancel</button>
            </div>
          </div>
        )}

        {showResignConfirm && (
          <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', zIndex: 20 }}>
            <h3>Resign this game?</h3>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={() => {
                  setGameResult({ winner: userSide === 'w' ? 'Black' : 'White', reason: 'Resignation' });
                  setShowResignConfirm(false);
                }}
                style={{ backgroundColor: 'var(--color-error)', borderColor: 'var(--color-error)' }}
              >Yes, Resign</button>
              <button onClick={() => setShowResignConfirm(false)}>Cancel</button>
            </div>
          </div>
        )}

        {/* Game Over Overlay */}
        {gameResult && (
          <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', zIndex: 10 }}>
            <h2>{gameResult.reason === 'Aborted' ? 'Game Aborted' : 'Game Over'}</h2>
            <div style={{ fontSize: '1.25rem' }}>
              {gameResult.reason === 'Aborted'
                ? 'Game was abandoned.'
                : (gameResult.winner === 'Draw' ? 'Draw' : `${gameResult.winner} wins`) + ` by ${gameResult.reason}`
              }
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '15px' }}>
              {gameResult.reason === 'Aborted' ? (
                <button
                  onClick={() => {
                    setGame(new Chess());
                    resetEngineState();
                    setGameResult(null);
                  }}
                  style={{ backgroundColor: 'var(--color-link)' }}
                >OK</button>
              ) : (
                <>
                  <button
                    onClick={() => startNewGame()}
                    style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-link)', color: 'var(--color-text)' }}
                  >Rematch</button>
                  <button
                    onClick={() => setGameResult(null)}
                    style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-link)', color: 'var(--color-text)' }}
                  >Close</button>
                  {savedGameId ? (
                    <button
                      id="game-over-analyze-button"
                      onClick={() => navigate({ to: '/analysis', search: { gameId: savedGameId, autoAnalyze: true } })}
                      style={{ backgroundColor: 'var(--color-link)' }}
                    >Analyze</button>
                  ) : (
                    !userId && (
                      <button
                        onClick={() => navigate({ to: '/auth/signin' })}
                        style={{ backgroundColor: 'var(--color-link)' }}
                      >Sign In to Analyze</button>
                    )
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Row */}
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
              const nextSide = userSide === 'w' ? 'b' : 'w';
              setUserSide(nextSide);
              // Persistence removed per user request: "Flip board should act as a one-off override"
            }}
            style={{ padding: '0.4rem 0.8rem' }}
            title="Flip Board"
          >
            <i className="fas fa-sync-alt" /> Flip Board
          </button>

          <button
            onClick={() => {
              if (isGameActive) setShowAbandonConfirm(true);
              else startNewGame();
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
            {zenMode ? " Exit Zen" : " Zen Mode"}
          </button>
        </div>

        <ChessClockDisplay
          timeMs={userSide === 'w' ? whiteTime : blackTime}
          isActive={game.turn() === userSide && !gameResult}
          side={userSide === 'w' ? "White" : "Black"}
          isLowTime={(userSide === 'w' ? whiteTime : blackTime) < 60000}
          onClick={!isGameActive ? () => handleClockClick(userSide === 'w' ? 'White' : 'Black') : undefined}
        />
      </div>

      {!zenMode && session?.user?.role === 'admin' && (
        <div style={{ marginTop: '1rem', padding: '1rem', border: '1px solid var(--color-bg-secondary)' }}>
          <h3>Debug Controls</h3>
          {/* Debug controls omitted for brevity, keeping existing logic */}
          <input type="range" min="0" max="20" value={engineLevel} onChange={(e) => setEngineLevel(parseInt(e.target.value))} />
          {engineLevel}
        </div>
      )}

      {/* Time Control Modal */}
      <Dialog ref={timeDialogRef}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ margin: 0 }}>Set Time for {modalRole}</h3>

          {modalError && <div style={{ color: 'red', fontSize: '0.9rem' }}>{modalError}</div>}

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label>Time (minutes)</label>
            <input
              type="number"
              value={tempTimeStr}
              onChange={e => setTempTimeStr(e.target.value)}
              step="0.1"
              style={{ padding: '0.5rem' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label>Increment (seconds)</label>
            <input
              type="number"
              value={tempIncStr}
              onChange={e => setTempIncStr(e.target.value)}
              step="1"
              style={{ padding: '0.5rem' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
            <button onClick={saveTimeConfig} style={{ flex: 1, backgroundColor: 'var(--color-primary)', color: 'white' }}>Save</button>
            <button onClick={() => timeDialogRef.current?.setIsOpen(false)} style={{ flex: 1 }}>Cancel</button>
          </div>
        </div>
      </Dialog>
    </div >
  );
}
