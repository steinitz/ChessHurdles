import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Chess } from 'chess.js';
import ChessBoard from '~/components/ChessBoard';
import { Spacer } from '~stzUtils/components/Spacer'
import { pgnToGameMoves, formatNiceDate } from '~/lib/chess-utils';
import {
  initializeStockfishWorker,
  cleanupWorker
} from '~/lib/stockfish-engine';
import { useSession } from '~stzUser/lib/auth-client';
import GameAnalysis from './Analysis/GameAnalysis';
import GameMoves from './GameMoves';
import GameNavigation from './GameNavigation';
import { saveHurdle as saveHurdleServer } from '~/lib/server/hurdles';
import { CHESSBOARD_WIDTH } from '~/constants';

interface GameMove {
  position: Chess;
  move?: string;
  moveNumber?: number;
  isWhiteMove?: boolean;
  from?: string;
  to?: string;
}

// Famous game: Kasparov vs Topalov, Wijk aan Zee 1999 (Kasparov's Immortal)
// const SAMPLE_GAME_MOVES = [
//   'e4', 'd6', 'd4', 'Nf6', 'Nc3', 'g6', 'Be3', 'Bg7', 'Qd2', 'c6',
//   'f3', 'b5', 'Nge2', 'Nbd7', 'Bh6', 'Bxh6', 'Qxh6', 'Bb7', 'a3', 'e5',
//   'O-O-O', 'Qe7', 'Kb1', 'a6', 'Nc1', 'O-O-O', 'Nb3', 'exd4', 'Rxd4', 'c5',
//   'Rd1', 'Nb6', 'g3', 'Kb8', 'Na5', 'Ba8', 'Bh3', 'd5', 'Qf4+', 'Ka7',
//   'Rhe1', 'd4', 'Nd5', 'Nbxd5', 'exd5', 'Qd6', 'Rxd4', 'cxd4', 'Re7+', 'Kb6',
//   'Qxd4+', 'Kxa5', 'b4+', 'Ka4', 'Qc3', 'Qxd5', 'Ra7', 'Bb7', 'Rxb7', 'Qc4',
//   'Qxf6', 'Kxa3', 'Qxa6+', 'Kxb4', 'c3+', 'Kxc3', 'Qa1+', 'Kd2', 'Qb2+', 'Kd1',
//   'Bf1', 'Rd2', 'Rd7', 'Rxd7', 'Bxc4', 'bxc4', 'Qxh8', 'Rd3', 'Qa8', 'c3',
//   'Qa4+', 'Ke1', 'f4', 'f5', 'Kc1', 'Rd2', 'Qa7'
// ];

// Test Game: Blunder sequence (hanging rook)
const SAMPLE_GAME_MOVES = [
  'e4', 'e5', 'Qh5', 'g6', 'Qxe5+', 'Qe7', 'Qxh8'
];

export function ChessGame({
  initialPGN,
  autoAnalyze,
  onHurdleSaved,
  title,
  date,
  description,
  result,
  userEloBefore,
  userEloAfter,
  whiteId,
  blackId
}: {
  initialPGN?: string;
  autoAnalyze?: boolean;
  onHurdleSaved?: () => void;
  title?: string;
  date?: string;
  description?: string;
  result?: string | null;
  userEloBefore?: number | null;
  userEloAfter?: number | null;
  whiteId?: string | null;
  blackId?: string | null;
}) {
  const [game, setGame] = useState(() => new Chess());
  const [gameMoves, setGameMoves] = useState<GameMove[]>([{ position: new Chess() }]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Analysis Summary State for Navigation
  const [analysisSummary, setAnalysisSummary] = useState<{ moveIndex: number; classification: string; isWhiteMove: boolean }[]>([]);

  // Helper to format title (strip parens, capitalize)
  const formatGameTitle = useCallback((rawTitle: string) => {
    // Strip parentheses from "Stockfish (Level N)" -> "Stockfish Level N"
    let formatted = rawTitle.replace(/\((Level\s+\d+)\)/gi, ' $1').trim();
    // Capitalize first letter
    if (formatted.length > 0) {
      formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);
    }
    return formatted;
  }, []);

  // Initialize title: prop > sample default
  const [gameTitle, setGameTitle] = useState(formatGameTitle(title || 'Kasparov vs Topalov, Wijk aan Zee 1999'));

  // Sync title prop if it changes
  useEffect(() => {
    if (title) {
      setGameTitle(formatGameTitle(title));
    }
  }, [title, formatGameTitle]);

  // Initialize description: prop > sample default (Step 2b: support structured fields)
  const [gameDescription, setGameDescription] = useState(() => {
    // New structured fields take precedence
    if (result || (userEloBefore !== null && userEloBefore !== undefined)) {
      const parts: string[] = [];
      if (result) parts.push(`Result ${result}`);
      if (userEloBefore !== null && userEloBefore !== undefined && userEloAfter !== null && userEloAfter !== undefined) {
        parts.push(`Elo ${userEloBefore} → ${userEloAfter}`);
      }
      if (date) parts.push(formatNiceDate(date));
      return parts.join(' \u00A0 \u00A0 '); // this makes a space of maybe 3 or 4 ems
    }
    // Fallback to description for old games - this may be no longer needed since the migration script updates the database
    if (description) {
      return description + (date ? ` ${formatNiceDate(date)}` : '');
    }
    return '"Kasparov\'s Immortal" Navigate through this famous game';
  });
  const [playerSide, setPlayerSide] = useState<'w' | 'b' | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Authentication
  const { data: session } = useSession();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Stockfish analysis refs (for game analysis only)
  const analysisWorkerRef = useRef<Worker | null>(null);

  // Initialize the sample game or a provided PGN
  const loadSampleGame = useCallback(() => {
    const newGame = new Chess();
    const moves: GameMove[] = [{ position: new Chess() }]; // Start with initial position

    let moveNumber = 1;
    let isWhiteMove = true;

    for (const move of SAMPLE_GAME_MOVES) {
      try {
        const moveResult = newGame.move(move);
        if (moveResult) {
          moves.push({
            position: new Chess(newGame.fen()),
            move: moveResult.san,
            moveNumber,
            isWhiteMove,
            from: moveResult.from,
            to: moveResult.to
          });

          if (!isWhiteMove) {
            moveNumber++;
          }
          isWhiteMove = !isWhiteMove;
        }
      } catch (error) {
        console.error('Invalid move in sample game:', move, error);
        break;
      }
    }

    setGameMoves(moves);
    setGame(new Chess()); // Start at initial position
    setCurrentMoveIndex(0);
    setGameTitle('Kasparov vs Topalov, Wijk aan Zee 1999');
    setGameDescription('"Kasparov\'s Immortal" - Navigate through this famous game');
  }, []);

  // Load PGN string into the game
  const handlePgnLoad = useCallback((pgnString: string) => {
    const result = pgnToGameMoves(pgnString);

    if (result.isValid) {
      setGameMoves(result.gameMoves);
      setGame(new Chess()); // Start at initial position
      setCurrentMoveIndex(0);

      // Only update title/desc from PGN if we don't have explicit props (or if PGN has better info than "Unknown")
      // But actually, if we are loading a specific game, we probably want the props to take precedence generally.
      // However, if the user uploads a NEW PGN, we want to update.
      // Current logic: initialPGN is passed.
      // If we have title prop, we used it in initial state.
      // If we are parsing initialPGN, we might overwrite it.
      // Let's only overwrite if state is currently the "default" sample strings?
      // Simpler: If title prop was provided, trust it for the initial load.
      // But handlePgnLoad might be called later? No, only in useEffect.

      const white = result.headers?.White || 'Unknown';
      const black = result.headers?.Black || 'Unknown';
      const userSideHeader = result.headers?.UserSide; // 'w' or 'b'

      // Determine player side
      // PRIORITY 1: Explicit Props (from Database)
      if (whiteId && session?.user?.id && whiteId === session.user.id) {
        setPlayerSide('w');
      } else if (blackId && session?.user?.id && blackId === session.user.id) {
        setPlayerSide('b');
      }
      // PRIORITY 2: PGN Header (Backward Compat)
      else if (userSideHeader === 'w' || userSideHeader === 'b') {
        setPlayerSide(userSideHeader as 'w' | 'b');
      }
      // PRIORITY 3: Name Matching (Heuristic Fallback)
      else if (session?.user?.name) {
        const userName = session.user.name;
        if (white === userName) setPlayerSide('w');
        else if (black === userName) setPlayerSide('b');
        else {
          // Heuristic fallback: detect engine
          const isWhiteEngine = /stockfish|engine|level/i.test(white);
          const isBlackEngine = /stockfish|engine|level/i.test(black);
          if (isWhiteEngine && !isBlackEngine) setPlayerSide('b');
          else if (isBlackEngine && !isWhiteEngine) setPlayerSide('w');
        }
      }

      // If we provided a title prop, don't overwrite it with "Unknown vs Unknown"
      if (!title) {
        // Strip parentheses from engine levels if present (e.g. "Stockfish (Level 5)" -> "Stockfish Level 5")
        const cleanWhite = white.replace(/\((Level\s+\d+)\)/gi, '$1').trim();
        const cleanBlack = black.replace(/\((Level\s+\d+)\)/gi, '$1').trim();

        let rawTitle = `${cleanWhite} vs ${cleanBlack}`;
        // Capitalize the first letter of the title
        rawTitle = rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1);

        setGameTitle(rawTitle);

        const event = result.headers?.Event || 'Chess Game';
        const pgnDate = result.headers?.Date || '';
        setGameDescription(event + (pgnDate ? ` ${formatNiceDate(pgnDate)}` : ''));
      }

      setError(null);
    } else {
      setError(result.error || 'Invalid PGN format');
    }
  }, [title, whiteId, blackId, session?.user?.id]);

  // Load initial PGN if provided, otherwise load sample game on mount
  useEffect(() => {
    if (initialPGN && initialPGN.trim().length > 0) {
      handlePgnLoad(initialPGN);
    } else {
      loadSampleGame();
    }
  }, [initialPGN, handlePgnLoad, loadSampleGame]);

  const goToMove = useCallback((moveIndex: number) => {
    if (moveIndex >= 0 && moveIndex < gameMoves.length) {
      setCurrentMoveIndex(moveIndex);
      setGame(new Chess(gameMoves[moveIndex].position.fen()));
    }
  }, [gameMoves]);

  const onMove = useCallback((move: string) => {
    // For now, we're just displaying a pre-loaded game
    // This callback could be used for interactive play in the future
  }, []);

  const handleAnalysisUpdate = useCallback((summary: { moveIndex: number; classification: string; isWhiteMove: boolean }[]) => {
    setAnalysisSummary(summary);
  }, []);

  const handleSaveHurdle = useCallback(async () => {
    if (!session?.user?.id) {
      setSaveMessage('Please sign in to save hurdles');
      setTimeout(() => setSaveMessage(null), 3000);
      return;
    }

    if (currentMoveIndex === 0) {
      setSaveMessage('Cannot save starting position as hurdle');
      setTimeout(() => setSaveMessage(null), 3000);
      return;
    }

    setIsSaving(true);
    setSaveMessage(null);

    try {
      const preMovePosition = gameMoves[currentMoveIndex - 1]?.position.fen();
      const currentMove = gameMoves[currentMoveIndex]?.move;

      if (!preMovePosition) return;

      await saveHurdleServer({
        data: {
          fen: preMovePosition,
          title: `${gameTitle} - Move ${currentMoveIndex}`,
          moveNumber: currentMoveIndex,
          playedMove: currentMove,
          aiDescription: `Position after ${currentMove}`,
        } as any
      });

      setSaveMessage('Hurdle saved!');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Error saving hurdle:', error);
      setSaveMessage('Failed to save hurdle');
      setTimeout(() => setSaveMessage(null), 5000);
    } finally {
      setIsSaving(false);
    }
  }, [session?.user?.id, currentMoveIndex, gameMoves, gameTitle]);

  const chessboardHeight = CHESSBOARD_WIDTH // allows game nav buttons to be comfortably on screen
  const containerWidth = `${chessboardHeight}` // wrapping avoids a typescript error - better way to fix?
  const chessgameTransportHeight = '8vh' // tall enough for the mvp.css default buttons

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '0',
      padding: '2rem 1rem 1rem 1rem',
      maxWidth: '80rem',
      margin: '0 auto'
    }}>
      {/* Negative margin pulls the board closer to the header text; exact cause of the persistent gap is unknown */}
      <header style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        width: containerWidth,
        margin: '0 auto -2.0rem auto',
      }}>
        <div style={{
          display: 'flex',
          flex: 1,
          overflow: 'hidden',
          marginRight: '1rem',
          justifyContent: 'flex-start'
        }}>
          <p style={{
            margin: 0,
            textAlign: 'left',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            minWidth: 0,
          }}>
            <span>{gameTitle}</span>
            <span style={{ display: 'inline-block', width: '1.5rem' }}></span>
            <span style={{ fontWeight: 400, opacity: 0.8 }}>{gameDescription}</span>
          </p>
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          flex: '0 0 auto',
          marginLeft: 'auto',
        }}>
          <p style={{
            margin: 0,
            whiteSpace: 'nowrap'
          }}>
            Move {currentMoveIndex} of {gameMoves.length - 1}
          </p>
        </div>
      </header>

      <div style={{
        width: containerWidth,
        margin: '0 auto'
      }}>
        <div style={{
          display: 'flex',
          gap: '0',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          height: `calc(${chessboardHeight} + ${chessgameTransportHeight})`,
          overflow: 'hidden'
        }}>
          <div style={{ margin: 0, padding: 0 }}>
            {isMounted && (
              <ChessBoard
                key={currentMoveIndex}
                game={game}
                onMove={onMove}
                boardSize={chessboardHeight}
                showCoordinates={true}
                boardOrientation={playerSide === 'b' ? 'black' : 'white'}
                customSquareStyles={
                  gameMoves[currentMoveIndex]?.from && gameMoves[currentMoveIndex]?.to
                    ? {
                      [gameMoves[currentMoveIndex].from!]: { backgroundColor: 'var(--color-move-highlight)' },
                      [gameMoves[currentMoveIndex].to!]: { backgroundColor: 'var(--color-move-highlight)' }
                    }
                    : {}
                }
              />
            )}
          </div>
          {/* <Spacer /> */}
          <GameNavigation
            currentMoveIndex={currentMoveIndex}
            totalMoves={gameMoves.length}
            goToMove={goToMove}
            containerHeight={chessgameTransportHeight}
            analysisSummary={analysisSummary}
            playerSide={playerSide}
            onSaveHurdle={handleSaveHurdle}
            isSaving={isSaving}
          />
        </div>

        {saveMessage && (
          <div style={{
            textAlign: 'center',
            padding: '0.5rem',
            color: saveMessage.includes('Failed') || saveMessage.includes('sign in') ? 'var(--color-error)' : 'var(--color-success)',
            fontSize: '0.9rem',
            fontWeight: 500
          }}>
            {saveMessage}
          </div>
        )}
        <GameAnalysis
          gameMoves={gameMoves}
          goToMove={goToMove}
          maxMovesToAnalyze={gameMoves.length - 1}
          autoAnalyze={autoAnalyze}
          onHurdleSaved={onHurdleSaved}
          currentMoveIndex={currentMoveIndex}
          onAnalysisUpdate={handleAnalysisUpdate}
          playerSide={playerSide}
        />

        <GameMoves
          gameMoves={gameMoves}
          currentMoveIndex={currentMoveIndex}
          goToMove={goToMove}
        />
      </div>


    </div >
  );
}

export default ChessGame;