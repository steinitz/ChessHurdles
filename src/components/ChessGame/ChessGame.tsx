import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Chess } from 'chess.js';
import ChessBoard from '~/components/ChessBoard';
import { Spacer } from '~stzUtils/components/Spacer'
import { pgnToGameMoves } from '~/lib/chess-utils';
import {
  initializeStockfishWorker,
  cleanupWorker
} from '~/lib/stockfish-engine';
import { useSession } from '~stzUser/lib/auth-client';
import GameAnalysis from './Analysis/GameAnalysis';
import GameMoves from './GameMoves';
import GameSaver from './GameSaver';
import GameNavigation from './GameNavigation';
import { CHESSBOARD_WIDTH } from '~/constants';

interface GameMove {
  position: Chess;
  move?: string;
  moveNumber?: number;
  isWhiteMove?: boolean;
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
  description
}: {
  initialPGN?: string;
  autoAnalyze?: boolean;
  onHurdleSaved?: () => void;
  title?: string;
  date?: string;
  description?: string;
}) {
  const [game, setGame] = useState(() => new Chess());
  const [gameMoves, setGameMoves] = useState<GameMove[]>([{ position: new Chess() }]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);

  // Initialize title: prop > sample default
  const [gameTitle, setGameTitle] = useState(title || 'Kasparov vs Topalov, Wijk aan Zee 1999');

  // Initialize description: prop > sample default
  const [gameDescription, setGameDescription] = useState(() => {
    if (description) {
      return description + (date ? ` (${new Date(date).toLocaleDateString()})` : '');
    }
    return '"Kasparov\'s Immortal" - Navigate through this famous game';
  });
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
            isWhiteMove
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

      // If we provided a title prop, don't overwrite it with "Unknown vs Unknown"
      if (!title) {
        setGameTitle(`${white} vs ${black}`);
        const event = result.headers?.Event || 'Chess Game';
        const pgnDate = result.headers?.Date || '';
        setGameDescription(event + (pgnDate ? `, ${pgnDate}` : ''));
      }

      setError(null);
    } else {
      setError(result.error || 'Invalid PGN format');
    }
  }, [title]);

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

  const chessboardHeight = CHESSBOARD_WIDTH // allows game nav buttons to be comfortably on screen
  const containerWidth = `${chessboardHeight}` // wrapping avoids a typescript error - better way to fix?
  const chessgameTransportHeight = '8vh' // tall enough for the mvp.css default buttons

  return (
    <div className="flex flex-col md:flex-row gap-4 p-4 max-w-7xl mx-auto">
      <header>
        <h2>{gameTitle}</h2>
        <p>{gameDescription}</p>
      </header>



      <div style={{
        width: containerWidth,
        margin: '0 auto'
      }}>
        <div style={{
          display: 'flex',
          gap: '1rem',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          height: `calc(${chessboardHeight} + ${chessgameTransportHeight})`,
          overflow: 'hidden'
        }}>
          <div>
            {isMounted && (
              <ChessBoard
                key={currentMoveIndex}
                game={game}
                onMove={onMove}
                boardSize={chessboardHeight}
                showCoordinates={true}
              />
            )}
          </div>
          {/* <Spacer /> */}
          <GameNavigation
            currentMoveIndex={currentMoveIndex}
            totalMoves={gameMoves.length}
            goToMove={goToMove}
            containerHeight={chessgameTransportHeight}
          />
        </div>

        {/* Save functionality section - moved below board */}
        {isMounted && session?.user && (
          <div style={{
            marginTop: '1rem',
            marginBottom: '1rem',
            padding: '0.5rem',
            border: '1px solid var(--color-bg-secondary)',
            borderRadius: '4px',
            width: '100%'
          }}>
            <GameSaver
              game={game}
              gameMoves={gameMoves}
              gameTitle={gameTitle}
              gameDescription={gameDescription}
              currentMoveIndex={currentMoveIndex}
            />
          </div>
        )}

        {isMounted && !session?.user && (
          <div style={{
            marginTop: '1rem',
            marginBottom: '1rem',
            padding: '0.5rem',
            border: '1px solid var(--color-bg-secondary)',
            borderRadius: '4px',
            width: '100%',
            textAlign: 'center'
          }}>
            <p style={{ margin: '0', fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>
              <a href="/auth/signin">Sign in</a> to save games and positions
            </p>
          </div>
        )}

        <p>Move {currentMoveIndex} of {gameMoves.length - 1}</p>

        <GameMoves
          gameMoves={gameMoves}
          currentMoveIndex={currentMoveIndex}
          goToMove={goToMove}
        />

        {/* PositionAnalysis removed to prioritize Game Analysis visibility */}

        {/* Game Analysis Section - constrained to chessboard container width */}
        {/* Game Analysis Section - constrained to chessboard container width */}
        <GameAnalysis
          gameMoves={gameMoves}
          goToMove={goToMove}
          maxMovesToAnalyze={gameMoves.length - 1}
          autoAnalyze={autoAnalyze}
          onHurdleSaved={onHurdleSaved}
        />
      </div>


    </div>
  );
}

export default ChessGame;