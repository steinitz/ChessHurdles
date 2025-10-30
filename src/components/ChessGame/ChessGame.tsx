import React, {useState, useCallback, useEffect, useRef} from 'react';
import {Chess} from 'chess.js';
import ChessBoard from '~/components/ChessBoard';
import {Spacer} from '~stzUtils/components/Spacer'
import { pgnToGameMoves } from '~/lib/chess-utils';
import { 
  initializeStockfishWorker, 
  analyzePosition, 
  handleEngineMessage,
  cleanupWorker,
  EngineEvaluation,
  EngineCallbacks
} from '~/lib/stockfish-engine';
import { useSession } from '~stzUser/lib/auth-client';
import GameLoad from './GameLoad';
import PositionAnalysis from './PositionAnalysis';
import GameAnalysis from './GameAnalysis';
import GameMoves from './GameMoves';

interface GameMove {
  position: Chess;
  move?: string;
  moveNumber?: number;
  isWhiteMove?: boolean;
}

// Famous game: Kasparov vs Topalov, Wijk aan Zee 1999 (Kasparov's Immortal)
const SAMPLE_GAME_MOVES = [
  'e4', 'd6', 'd4', 'Nf6', 'Nc3', 'g6', 'Be3', 'Bg7', 'Qd2', 'c6',
  'f3', 'b5', 'Nge2', 'Nbd7', 'Bh6', 'Bxh6', 'Qxh6', 'Bb7', 'a3', 'e5',
  'O-O-O', 'Qe7', 'Kb1', 'a6', 'Nc1', 'O-O-O', 'Nb3', 'exd4', 'Rxd4', 'c5',
  'Rd1', 'Nb6', 'g3', 'Kb8', 'Na5', 'Ba8', 'Bh3', 'd5', 'Qf4+', 'Ka7',
  'Rhe1', 'd4', 'Nd5', 'Nbxd5', 'exd5', 'Qd6', 'Rxd4', 'cxd4', 'Re7+', 'Kb6',
  'Qxd4+', 'Kxa5', 'b4+', 'Ka4', 'Qc3', 'Qxd5', 'Ra7', 'Bb7', 'Rxb7', 'Qc4',
  'Qxf6', 'Kxa3', 'Qxa6+', 'Kxb4', 'c3+', 'Kxc3', 'Qa1+', 'Kd2', 'Qb2+', 'Kd1',
  'Bf1', 'Rd2', 'Rd7', 'Rxd7', 'Bxc4', 'bxc4', 'Qxh8', 'Rd3', 'Qa8', 'c3',
  'Qa4+', 'Ke1', 'f4', 'f5', 'Kc1', 'Rd2', 'Qa7'
];

export function ChessGame({ initialPGN }: { initialPGN?: string }) {
  const [game, setGame] = useState(() => new Chess());
  const [gameMoves, setGameMoves] = useState<GameMove[]>([{ position: new Chess() }]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
  const [analysisDepth, setAnalysisDepth] = useState(10);
  const [engineEvaluation, setEngineEvaluation] = useState<EngineEvaluation | null>(null);
  const [gameTitle, setGameTitle] = useState('Kasparov vs Topalov, Wijk aan Zee 1999');
  const [gameDescription, setGameDescription] = useState('"Kasparov\'s Immortal" - Navigate through this famous game');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Save functionality state
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [savedGameId, setSavedGameId] = useState<string | null>(null);
  
  // Authentication
  const { data: session } = useSession();
  
  // Stockfish analysis refs
  const analysisWorkerRef = useRef<Worker | null>(null);
  const positionWorkerRef = useRef<Worker | null>(null);
  const positionStartTimeRef = useRef<number>(0);
  const positionAnalyzingFenRef = useRef<string>('');

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
      
      // Try to extract game info from PGN headers
      const white = result.headers?.White || 'Unknown';
      const black = result.headers?.Black || 'Unknown';
      const event = result.headers?.Event || 'Chess Game';
      const date = result.headers?.Date || '';
      
      setGameTitle(`${white} vs ${black}`);
      setGameDescription(event + (date ? `, ${date}` : ''));
      setError(null);
    } else {
      setError(result.error || 'Invalid PGN format');
    }
  }, []);

  // Load initial PGN if provided, otherwise load sample game on mount
  useEffect(() => {
    if (initialPGN && initialPGN.trim().length > 0) {
      handlePgnLoad(initialPGN);
    } else {
      loadSampleGame();
    }
  }, [initialPGN, handlePgnLoad, loadSampleGame]);

  // Cleanup Stockfish workers on unmount
  useEffect(() => {
    return () => {
      if (analysisWorkerRef.current) {
        cleanupWorker(analysisWorkerRef.current);
      }
      if (positionWorkerRef.current) {
        cleanupWorker(positionWorkerRef.current);
      }
    };
  }, []);

  // Handle clearing PGN and returning to sample game
  const handlePgnClear = useCallback(() => {
    loadSampleGame();
  }, [loadSampleGame]);

  const goToMove = useCallback((moveIndex: number) => {
    if (moveIndex >= 0 && moveIndex < gameMoves.length) {
      setCurrentMoveIndex(moveIndex);
      setGame(new Chess(gameMoves[moveIndex].position.fen()));
    }
  }, [gameMoves]);

  const goToPreviousMove = useCallback(() => {
    if (currentMoveIndex > 0) {
      goToMove(currentMoveIndex - 1);
    }
  }, [currentMoveIndex, goToMove]);

  const goToNextMove = useCallback(() => {
    if (currentMoveIndex < gameMoves.length - 1) {
      goToMove(currentMoveIndex + 1);
    }
  }, [currentMoveIndex, gameMoves.length, goToMove]);

  const goToStart = useCallback(() => {
    goToMove(0);
  }, [goToMove]);

  const goToEnd = useCallback(() => {
    goToMove(gameMoves.length - 1);
  }, [gameMoves.length, goToMove]);

  const onMove = useCallback((move: string) => {
    // For now, we're just displaying a pre-loaded game
    // This callback could be used for interactive play in the future
  }, []);

  const handleAnalyzePosition = useCallback(() => {
    // Initialize position worker if not already done
    if (!positionWorkerRef.current) {
      positionWorkerRef.current = initializeStockfishWorker(
        (event: MessageEvent) => {
          const message = event.data;
          const callbacks: EngineCallbacks = {
            setEvaluation: (evaluation: EngineEvaluation) => {
              setEngineEvaluation(evaluation);
            },
            setIsAnalyzing,
            onEvaluation: (evaluation, bestMove, principalVariation) => {
              setEngineEvaluation({ 
                evaluation, 
                bestMove, 
                principalVariation,
                depth: analysisDepth,
                calculationTime: 0
              });
            },
            onCalculationTime: (timeMs) => {
              setEngineEvaluation(prev => prev ? { ...prev, calculationTime: timeMs } : null);
            }
          };
          
          handleEngineMessage(
            message,
            analysisDepth,
            positionStartTimeRef.current,
            positionAnalyzingFenRef.current,
            callbacks
          );
        },
        (errorMsg: string) => {
          setError(errorMsg);
          setIsAnalyzing(false);
        }
      );
    }

    // Analyze current position
    analyzePosition(
      positionWorkerRef.current,
      game.fen(),
      analysisDepth,
      isAnalyzing,
      setIsAnalyzing,
      setError,
      positionStartTimeRef,
      positionAnalyzingFenRef
    );
  }, [game, analysisDepth, isAnalyzing]);



  const formatEvaluation = (evaluation: number) => {
    if (Math.abs(evaluation) > 5000) {
      return evaluation > 0 ? 'White mates' : 'Black mates';
    }
    return (evaluation / 100).toFixed(1);
  };

  // Save game to database
  const handleSaveGame = useCallback(async () => {
    if (!session?.user?.id) {
      setSaveMessage('Please sign in to save games');
      return;
    }

    setIsSaving(true);
    setSaveMessage(null);

    try {
      // Generate PGN from current game history
      const tempGame = new Chess();
      const moves = gameMoves.slice(1).map(gameMove => gameMove.move!); // Skip initial position, get move strings
      
      // Reconstruct the game to generate PGN
      for (const move of moves) {
        tempGame.move(move);
      }
      
      const pgn = tempGame.pgn();
      
      // Prepare game data
      const gameData = {
        title: gameTitle,
        description: gameDescription,
        pgn: pgn,
        game_type: 'game' as const,
        difficulty_rating: null,
        tags: JSON.stringify(['imported']),
        is_favorite: false
      };

      let result;
      if (savedGameId) {
        // Update existing game
        const response = await fetch(`/api/chess/games`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gameId: savedGameId, ...gameData })
        });
        
        if (!response.ok) {
          throw new Error('Failed to update game');
        }
        
        result = await response.json();
        setSaveMessage('Game updated successfully!');
      } else {
        // Save new game
        const response = await fetch('/api/chess/games', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(gameData)
        });
        
        if (!response.ok) {
          throw new Error('Failed to save game');
        }
        
        result = await response.json();
        setSavedGameId(result.id);
        setSaveMessage('Game saved successfully!');
      }
      
      // Clear message after 3 seconds
      setTimeout(() => setSaveMessage(null), 3000);
      
    } catch (error) {
      console.error('Error saving game:', error);
      setSaveMessage('Failed to save game. Please try again.');
      setTimeout(() => setSaveMessage(null), 5000);
    } finally {
      setIsSaving(false);
    }
  }, [session?.user?.id, gameTitle, gameDescription, gameMoves, savedGameId]);

  // Save current position as a hurdle
  const handleSaveHurdle = useCallback(async () => {
    if (!session?.user?.id) {
      setSaveMessage('Please sign in to save hurdles');
      return;
    }

    if (currentMoveIndex === 0) {
      setSaveMessage('Cannot save starting position as hurdle');
      return;
    }

    setIsSaving(true);
    setSaveMessage(null);

    try {
      const currentPosition = game.fen();
      const currentMove = gameMoves[currentMoveIndex]?.move;
      
      const hurdleData = {
        game_id: savedGameId, // Optional reference to parent game
        fen: currentPosition,
        title: `${gameTitle} - Move ${currentMoveIndex}`,
        notes: `Position after ${currentMove}`,
        move_number: currentMoveIndex,
        evaluation: engineEvaluation?.evaluation || null,
        best_move: engineEvaluation?.bestMove || null,
        difficulty_level: null,
        last_practiced: null
      };

      const response = await fetch('/api/chess/hurdles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(hurdleData)
      });
      
      if (!response.ok) {
        throw new Error('Failed to save hurdle');
      }
      
      await response.json();
      setSaveMessage('Position saved as hurdle!');
      
      // Clear message after 3 seconds
      setTimeout(() => setSaveMessage(null), 3000);
      
    } catch (error) {
      console.error('Error saving hurdle:', error);
      setSaveMessage('Failed to save hurdle. Please try again.');
      setTimeout(() => setSaveMessage(null), 5000);
    } finally {
      setIsSaving(false);
    }
  }, [session?.user?.id, game, gameTitle, currentMoveIndex, gameMoves, engineEvaluation, savedGameId]);

  const chessboardHeight = '75vh' // allows game nav buttons to be comfortably on screen
  const containerWidth = `${chessboardHeight}` // wrapping avoids a typescript error - better way to fix?
  const chessgameTransportHeight = '8vh' // tall enough for the mvp.css default buttons

  return (
    <section>
      <header>
        <h2>{gameTitle}</h2>
        <p>{gameDescription}</p>
      </header>
      
      <GameLoad onPgnLoad={handlePgnLoad} onClear={handlePgnClear} />
      
      {/* Save functionality section */}
      {session?.user && (
        <div style={{ 
          marginBottom: '1rem', 
          padding: '0.5rem', 
          border: '1px solid var(--color-bg-secondary)', 
          borderRadius: '4px',
          maxWidth: containerWidth 
        }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={handleSaveGame}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : (savedGameId ? 'Update Game' : 'Save Game')}
            </button>
            <button
              onClick={handleSaveHurdle}
              disabled={isSaving || currentMoveIndex === 0}
            >
              {isSaving ? 'Saving...' : 'Save Position as Hurdle'}
            </button>
            {saveMessage && (
              <span style={{ 
                color: saveMessage.includes('Failed') || saveMessage.includes('Please sign in') 
                  ? 'var(--color-error)' 
                  : 'var(--color-success, green)',
                fontSize: '0.9rem'
              }}>
                {saveMessage}
              </span>
            )}
          </div>
        </div>
      )}
      
      {!session?.user && (
        <div style={{ 
          marginBottom: '1rem', 
          padding: '0.5rem', 
          border: '1px solid var(--color-bg-secondary)', 
          borderRadius: '4px',
          maxWidth: containerWidth,
          textAlign: 'center'
        }}>
          <p style={{ margin: '0', fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>
            <a href="/auth/signin">Sign in</a> to save games and positions
          </p>
        </div>
      )}
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
            <ChessBoard
              key={currentMoveIndex}
              game={game}
              onMove={onMove}
              boardSize={chessboardHeight}
              showCoordinates={true}
            />
          </div>
          {/* <Spacer /> */}
          <div style={{
            minWidth: '280px',
            flex: '1 1 auto',
            display: 'flex',
            flexDirection: 'column',
            height: chessgameTransportHeight
          }}>
            <div style={{
              display: 'flex',
              flexDirection: 'row',
              justifyContent: 'space-between',
              marginBottom: '0.5rem'
            }}>
              <button
                onClick={goToStart}
                disabled={currentMoveIndex === 0}
              >
                ⏮ Start
              </button>
              <button
                onClick={goToPreviousMove}
                disabled={currentMoveIndex === 0}
              >
                ◀ Prev
              </button>
              <button
                onClick={goToNextMove}
                disabled={currentMoveIndex === gameMoves.length - 1}
              >
                Next ▶
              </button>
              <button
                onClick={goToEnd}
                disabled={currentMoveIndex === gameMoves.length - 1}
              >
                &nbsp;&nbsp;End ⏭
              </button>
            </div>
          </div>
        </div>
        
        {/* Engine Analysis Section - Moved outside constrained height container */}
        <PositionAnalysis
          isAnalyzing={isAnalyzing}
          analysisDepth={analysisDepth}
          engineEvaluation={engineEvaluation}
          error={error}
          containerWidth={containerWidth}
          onAnalyzePosition={handleAnalyzePosition}
          onDepthChange={setAnalysisDepth}
          formatEvaluation={formatEvaluation}
        />
        
        {/* Game Analysis Section */}
        <GameAnalysis
          analysisWorkerRef={analysisWorkerRef}
          gameMoves={gameMoves}
          containerWidth={parseInt(containerWidth)}
          goToMove={goToMove}
        />
        
        <p>Move {currentMoveIndex} of {gameMoves.length - 1}</p>

        <GameMoves
          gameMoves={gameMoves}
          currentMoveIndex={currentMoveIndex}
          goToMove={goToMove}
        />
      </div>
    </section >
  );
}

export default ChessGame;