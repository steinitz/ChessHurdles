import React, {useState, useCallback, useEffect, useRef} from 'react';
import {Chess} from 'chess.js';
import ChessBoard from './ChessBoard';
import {Spacer} from '~stzUtils/components/Spacer'
import PgnInput from './PgnInput';
import EvaluationGraph from './EvaluationGraph';
import { pgnToGameHistory } from '../lib/chess-utils';
import { 
  initializeStockfishWorker, 
  analyzePosition, 
  handleEngineMessage,
  cleanupWorker,
  EngineEvaluation,
  EngineCallbacks
} from '../lib/stockfish-engine';
import { useSession } from '~stzUser/lib/auth-client';

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
  const [gameHistory, setGameHistory] = useState<Chess[]>([new Chess()]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [analysisDepth, setAnalysisDepth] = useState(10);
  const [engineEvaluation, setEngineEvaluation] = useState<{
    evaluation: number;
    bestMove: string;
    pv: string;
    calculationTime?: number;
  } | null>(null);
  const [gameTitle, setGameTitle] = useState('Kasparov vs Topalov, Wijk aan Zee 1999');
  const [gameDescription, setGameDescription] = useState('"Kasparov\'s Immortal" - Navigate through this famous game');
  const [moveAnalysisResults, setMoveAnalysisResults] = useState<string>('');
  const [isAnalyzingMoves, setIsAnalyzingMoves] = useState(false);
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
  const startTimeRef = useRef<number>(0);
  const analyzingFenRef = useRef<string>('');
  const positionStartTimeRef = useRef<number>(0);
  const positionAnalyzingFenRef = useRef<string>('');
  const targetMovesRef = useRef<string[]>([]);
  const targetPositionsRef = useRef<Chess[]>([]);
  const analysisResultsRef = useRef<EngineEvaluation[]>([]);
  const currentAnalysisIndexRef = useRef<number>(0);

  // Initialize the sample game or a provided PGN
  const loadSampleGame = useCallback(() => {
    const newGame = new Chess();
    const history: Chess[] = [new Chess()];
    const moves: string[] = [];

    for (const move of SAMPLE_GAME_MOVES) {
      try {
        const moveResult = newGame.move(move);
        if (moveResult) {
          moves.push(moveResult.san);
          history.push(new Chess(newGame.fen()));
        }
      } catch (error) {
        console.error('Invalid move in sample game:', move, error);
        break;
      }
    }

    setGameHistory(history);
    setMoveHistory(moves);
    setGame(new Chess()); // Start at initial position
    setCurrentMoveIndex(0);
    setGameTitle('Kasparov vs Topalov, Wijk aan Zee 1999');
    setGameDescription('"Kasparov\'s Immortal" - Navigate through this famous game');
  }, []);

  // Load PGN string into the game
  const handlePgnLoad = useCallback((pgnString: string) => {
    const result = pgnToGameHistory(pgnString);
    
    if (result.isValid) {
      setGameHistory(result.history);
      setMoveHistory(result.moves);
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
    if (moveIndex >= 0 && moveIndex < gameHistory.length) {
      setCurrentMoveIndex(moveIndex);
      setGame(new Chess(gameHistory[moveIndex].fen()));
    }
  }, [gameHistory]);

  const goToPreviousMove = useCallback(() => {
    if (currentMoveIndex > 0) {
      goToMove(currentMoveIndex - 1);
    }
  }, [currentMoveIndex, goToMove]);

  const goToNextMove = useCallback(() => {
    if (currentMoveIndex < gameHistory.length - 1) {
      goToMove(currentMoveIndex + 1);
    }
  }, [currentMoveIndex, gameHistory.length, goToMove]);

  const goToStart = useCallback(() => {
    goToMove(0);
  }, [goToMove]);

  const goToEnd = useCallback(() => {
    goToMove(gameHistory.length - 1);
  }, [gameHistory.length, goToMove]);

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
              setEngineEvaluation({
                evaluation: evaluation.evaluation,
                bestMove: evaluation.bestMove,
                pv: evaluation.principalVariation,
                calculationTime: evaluation.calculationTime
              });
            },
            setIsAnalyzing,
            onEvaluation: (evaluation, bestMove, pv) => {
              setEngineEvaluation({ evaluation, bestMove, pv });
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

  const handleAnalyzeEntireGame = useCallback(() => {
    if (moveHistory.length === 0) {
      setMoveAnalysisResults('No moves in the game to analyze.');
      return;
    }

    if (isAnalyzingMoves) {
      setMoveAnalysisResults('Analysis already in progress...');
      return;
    }

    // Analyze all moves in the game
    const targetMoves = moveHistory.slice();
    const targetPositions = gameHistory.slice(1); // Skip initial position, analyze positions after each move

    setMoveAnalysisResults(`Starting analysis of entire game (${targetMoves.length} moves)...\n\nInitializing Stockfish engine...`);

    // Store in refs for sequential analysis
    targetMovesRef.current = targetMoves;
    targetPositionsRef.current = targetPositions;
    analysisResultsRef.current = [];
    currentAnalysisIndexRef.current = 0;

    setIsAnalyzingMoves(true);

    // Initialize Stockfish worker if not already done
    if (!analysisWorkerRef.current) {
      analysisWorkerRef.current = initializeStockfishWorker(
        (event: MessageEvent) => {
          const message = event.data;
          const callbacks: EngineCallbacks = {
            setEvaluation: (evaluation: EngineEvaluation) => {
              // Store this evaluation result
              analysisResultsRef.current[currentAnalysisIndexRef.current] = evaluation;
              
              // Update progress
              const progress = currentAnalysisIndexRef.current + 1;
              const total = targetPositionsRef.current.length;
              setMoveAnalysisResults(`Analyzing move ${progress} of ${total}...\n\nProgress: ${Math.round((progress / total) * 100)}%`);
              
              // Move to next position or finish
              currentAnalysisIndexRef.current++;
              if (currentAnalysisIndexRef.current < targetPositionsRef.current.length) {
                // Analyze next position
                const nextPosition = targetPositionsRef.current[currentAnalysisIndexRef.current];
                if (nextPosition) {
                  analyzePosition(
                    analysisWorkerRef.current,
                    nextPosition.fen(),
                    3, // depth
                    false,
                    () => {}, // setIsAnalyzing - we manage this ourselves
                    () => {}, // setError
                    startTimeRef,
                    analyzingFenRef
                  );
                }
              } else {
                // All positions analyzed, display results
                displayAnalysisResults();
              }
            },
            setIsAnalyzing: () => {}, // We manage this ourselves
          };

          handleEngineMessage(
            message,
            3, // depth
            startTimeRef.current,
            analyzingFenRef.current,
            callbacks
          );
        },
        (error: string) => {
          setMoveAnalysisResults(`Error initializing Stockfish: ${error}`);
          setIsAnalyzingMoves(false);
        }
      );
    }

    // Start analyzing the first position
    if (targetPositions.length > 0 && targetPositions[0]) {
      setTimeout(() => {
        analyzePosition(
          analysisWorkerRef.current,
          targetPositions[0].fen(),
          3, // depth
          false,
          () => {}, // setIsAnalyzing - we manage this ourselves
          () => {}, // setError
          startTimeRef,
          analyzingFenRef
        );
      }, 1000); // Give Stockfish time to initialize
    }
  }, [moveHistory, gameHistory, isAnalyzingMoves]);

  const handleAnalyzeMoves15to20 = useCallback(() => {
    if (moveHistory.length < 20) {
      setMoveAnalysisResults('Not enough moves in the game. Need at least 20 moves to analyze moves 15-20.');
      return;
    }

    if (isAnalyzingMoves) {
      setMoveAnalysisResults('Analysis already in progress...');
      return;
    }

    // Extract moves 15-20 (array indices 14-19)
    const targetMoves = moveHistory.slice(14, 20);
    const targetPositions = gameHistory.slice(15, 21); // Positions after moves 15-20

    // Store in refs for sequential analysis
    targetMovesRef.current = targetMoves;
    targetPositionsRef.current = targetPositions;
    analysisResultsRef.current = [];
    currentAnalysisIndexRef.current = 0;

    setIsAnalyzingMoves(true);
    setMoveAnalysisResults('Starting analysis of moves 15-20...\n\nInitializing Stockfish engine...');

    // Initialize Stockfish worker if not already done
    if (!analysisWorkerRef.current) {
      analysisWorkerRef.current = initializeStockfishWorker(
        (event: MessageEvent) => {
          const message = event.data;
          const callbacks: EngineCallbacks = {
            setEvaluation: (evaluation: EngineEvaluation) => {
              // Store this evaluation result
              analysisResultsRef.current[currentAnalysisIndexRef.current] = evaluation;
              
              // Move to next position or finish
              currentAnalysisIndexRef.current++;
              if (currentAnalysisIndexRef.current < targetPositionsRef.current.length) {
                // Analyze next position
                const nextPosition = targetPositionsRef.current[currentAnalysisIndexRef.current];
                if (nextPosition) {
                  analyzePosition(
                    analysisWorkerRef.current,
                    nextPosition.fen(),
                    3, // depth
                    false,
                    () => {}, // setIsAnalyzing - we manage this ourselves
                    () => {}, // setError
                    startTimeRef,
                    analyzingFenRef
                  );
                }
              } else {
                // All positions analyzed, display results
                displayAnalysisResults();
              }
            },
            setIsAnalyzing: () => {}, // We manage this ourselves
          };

          handleEngineMessage(
            message,
            3, // depth
            startTimeRef.current,
            analyzingFenRef.current,
            callbacks
          );
        },
        (error: string) => {
          setMoveAnalysisResults(`Error initializing Stockfish: ${error}`);
          setIsAnalyzingMoves(false);
        }
      );
    }

    // Start analyzing the first position
    if (targetPositions.length > 0 && targetPositions[0]) {
      setTimeout(() => {
        analyzePosition(
          analysisWorkerRef.current,
          targetPositions[0].fen(),
          3, // depth
          false,
          () => {}, // setIsAnalyzing - we manage this ourselves
          () => {}, // setError
          startTimeRef,
          analyzingFenRef
        );
      }, 1000); // Give Stockfish time to initialize
    }
  }, [moveHistory, gameHistory, isAnalyzingMoves]);

  const displayAnalysisResults = useCallback(() => {
    const targetMoves = targetMovesRef.current;
    const results = analysisResultsRef.current;
    
    // Determine what was analyzed based on the moves
    const isFullGame = targetMoves.length === moveHistory.length;
    const startMoveNumber = isFullGame ? 1 : 15;
    const analysisType = isFullGame ? 'Entire Game' : 'Moves 15-20';
    
    // Get depth from first result (all moves analyzed at same depth)
    const analysisDepth = results.length > 0 ? results[0].depth : 3;
    
    let analysisText = `Move Analysis Results (${analysisType}) - Depth ${analysisDepth}:\n\n`;
    
    // Helper function to normalize evaluation to mover's perspective
    const normalizeEvaluation = (evaluation: number, isWhiteToMove: boolean): number => {
      return isWhiteToMove ? evaluation : -evaluation;
    };
    
    // Helper function to detect mate scores
    const isMateScore = (evaluation: number): boolean => {
      return Math.abs(evaluation) > 5000;
    };
    
    // Helper function to get mate distance
    const getMateDistance = (evaluation: number): number => {
      return Math.abs(evaluation) - 5000;
    };
    
    targetMoves.forEach((move, index) => {
      const moveNumber = startMoveNumber + index;
      const result = results[index];
      const isWhiteMove = (moveNumber % 2) === 1;
      
      analysisText += `Move ${moveNumber}: ${move}\n`;
      
      if (result) {
        const evalStr = Math.abs(result.evaluation) > 5000 
          ? `#${Math.sign(result.evaluation) * (Math.abs(result.evaluation) - 5000)}`
          : (result.evaluation / 100).toFixed(2);
        analysisText += `  Evaluation: ${evalStr}\n`;
        analysisText += `  Best Move: ${result.bestMove}\n`;
        analysisText += `  Time: ${result.calculationTime}ms\n`;
        
        // Calculate centipawnLoss if we have a previous result
        if (index > 0) {
          const prevResult = results[index - 1];
          if (prevResult) {
            // Get evaluations from mover's perspective
            const preCp = normalizeEvaluation(prevResult.evaluation, isWhiteMove);
            const postCp = normalizeEvaluation(result.evaluation, !isWhiteMove); // Opponent's perspective, so flip

            // Calculate centipawnLoss: max(0, preCp + postCp)
            const centipawnLoss = Math.max(0, preCp + postCp);

            analysisText += `  centipawnLoss: ${centipawnLoss}\n`;

            // Highlight significant centipawnLoss (≥150 = mistake/blunder threshold)
            if (centipawnLoss >= 150) {
              if (centipawnLoss >= 300) {
                analysisText += `  ⚠️  BLUNDER (centipawnLoss ≥300)\n`;
              } else {
                analysisText += `  ⚠️  MISTAKE (centipawnLoss ≥150)\n`;
              }
            }
          }
        }
        
        // Check for mate≤5 detection
        if (isMateScore(result.evaluation)) {
          const mateDistance = getMateDistance(result.evaluation);
          if (mateDistance <= 5) {
            const mateSign = result.evaluation > 0 ? '+' : '-';
            analysisText += `  🎯 MATE≤5 DETECTED: ${mateSign}M${mateDistance}\n`;
          }
        }
        
      } else {
        analysisText += `  Analysis: Failed\n`;
      }
      analysisText += '\n';
    });

    analysisText += 'Analysis complete!';
    setMoveAnalysisResults(analysisText);
    setIsAnalyzingMoves(false);
  }, [moveHistory.length]);

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
      const moves = moveHistory;
      
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
  }, [session?.user?.id, gameTitle, gameDescription, moveHistory, savedGameId]);

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
      const currentMove = moveHistory[currentMoveIndex - 1];
      
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
  }, [session?.user?.id, game, gameTitle, currentMoveIndex, moveHistory, engineEvaluation, savedGameId]);

  const chessboardHeight = '75vh' // allows game nav buttons to be comfortably on screen
  const containerWidth = `${chessboardHeight}` // wrapping avoids a typescript error - better way to fix?
  const chessgameTransportHeight = '8vh' // tall enough for the mvp.css default buttons

  return (
    <section>
      <header>
        <h2>{gameTitle}</h2>
        <p>{gameDescription}</p>
      </header>
      
      <PgnInput onPgnLoad={handlePgnLoad} onClear={handlePgnClear} />
      
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
                disabled={currentMoveIndex === gameHistory.length - 1}
              >
                Next ▶
              </button>
              <button
                onClick={goToEnd}
                disabled={currentMoveIndex === gameHistory.length - 1}
              >
                &nbsp;&nbsp;End ⏭
              </button>
            </div>
          </div>
        </div>
        
        {/* Engine Analysis Section - Moved outside constrained height container */}
        <div style={{ marginTop: '1rem', padding: '0.5rem', border: '1px solid var(--color-bg-secondary)', borderRadius: '4px', maxWidth: containerWidth }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <button
              onClick={handleAnalyzePosition}
              disabled={isAnalyzing}
            >
              {isAnalyzing ? 'Analyzing...' : 'Analyze Position'}
            </button>
            <label>
              Depth:
              <input
                type="range"
                min="1"
                max="15"
                value={analysisDepth}
                onChange={(e) => setAnalysisDepth(parseInt(e.target.value))}
                style={{ marginLeft: '0.5rem', width: '80px' }}
              />
              <span style={{ marginLeft: '0.5rem' }}>{analysisDepth}</span>
            </label>
          </div>
          
          {error && (
            <p style={{ color: 'var(--color-error)', fontSize: '0.9rem' }}>
              Error: {error}
            </p>
          )}
          
          {engineEvaluation && (
            <div style={{ fontSize: '0.9rem' }}>
              <p><strong>Evaluation:</strong> {formatEvaluation(engineEvaluation.evaluation)}</p>
              {engineEvaluation.bestMove && (
                <p><strong>Best Move:</strong> {engineEvaluation.bestMove}</p>
              )}
              {engineEvaluation.calculationTime && (
                <p><strong>Time:</strong> {engineEvaluation.calculationTime}ms</p>
              )}
              {engineEvaluation.pv && (
                <p><strong>Principal Variation:</strong> {engineEvaluation.pv}</p>
              )}
            </div>
          )}
        </div>
        
        {/* Move Analysis Section */}
        <div style={{ marginTop: '1rem', padding: '0.5rem', border: '1px solid var(--color-bg-secondary)', borderRadius: '4px', maxWidth: containerWidth }}>
          <h3>Move Analysis</h3>
          <div style={{ marginBottom: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button 
              onClick={handleAnalyzeEntireGame}
              disabled={isAnalyzingMoves}
            >
              {isAnalyzingMoves ? 'Analyzing...' : 'Analyze Entire Game (Depth 3)'}
            </button>
            <button 
              onClick={handleAnalyzeMoves15to20}
              disabled={isAnalyzingMoves}
            >
              {isAnalyzingMoves ? 'Analyzing...' : 'Analyze Moves 15-20 (Depth 3)'}
            </button>
          </div>
          
          {/* Evaluation Graph */}
          {analysisResultsRef.current.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <EvaluationGraph 
                evaluations={analysisResultsRef.current.map((result, index) => {
                  // Get the position that was analyzed to determine whose turn it was
                  const position = targetPositionsRef.current[index];
                  const isBlackToMove = position && position.turn() === 'b';
                  
                  // Convert evaluation to White's perspective
                  // Stockfish returns evaluation from the perspective of the side to move
                  // For chess evaluation graphs, we want consistent White perspective
                  const whiteEvaluation = isBlackToMove ? -result.evaluation : result.evaluation;
                  
                  // Determine move number based on analysis type
                  const isFullGame = targetMovesRef.current.length === moveHistory.length;
                  const startMoveNumber = isFullGame ? 1 : 15;
                  
                  return {
                    evaluation: whiteEvaluation,
                    moveNumber: startMoveNumber + index,
                    isMate: Math.abs(result.evaluation) > 5000,
                    severity: Math.abs(whiteEvaluation) > 300 ? 'high' : 
                             Math.abs(whiteEvaluation) > 100 ? 'medium' : 'low'
                  };
                })}
                onMoveClick={(moveIndex) => {
                  // Navigate to the clicked move
                  const isFullGame = targetMovesRef.current.length === moveHistory.length;
                  const startMoveNumber = isFullGame ? 1 : 15;
                  const actualMoveIndex = startMoveNumber + moveIndex;
                  goToMove(actualMoveIndex);
                }}
              />
            </div>
          )}
          
          <textarea
            rows={10}
            cols={50}
            readOnly
            value={moveAnalysisResults || "Click 'Analyze Moves 15-20' to see the analysis results for moves 15-20 of the current game."}
          />
        </div>
        
        <p>Move {currentMoveIndex} of {gameHistory.length - 1}</p>

        <details open >
          <summary>Moves</summary>
          <div style={{
            padding: '0.5rem',
            border: '1px solid var(--color-accent)',
            borderRadius: '4px',
          }}>
            {moveHistory.map((move, index) => {
              const moveNumber = Math.floor(index / 2) + 1;
              const isWhiteMove = index % 2 === 0;
              const isCurrentMove = index + 1 === currentMoveIndex;

              return (
                <span
                  key={index}
                  style={{
                    cursor: 'pointer',
                    padding: '2px 4px',
                    borderRadius: '2px',
                    backgroundColor: isCurrentMove ? 'var(--color-accent)' : 'transparent',
                    color: isCurrentMove ? 'white' : 'inherit'
                  }}
                  onClick={() => goToMove(index + 1)}
                >
                  {isWhiteMove && `${moveNumber}. `}{move}{' '}
                </span>
              );
            })}
          </div>
        </details>
      </div>
    </section >
  );
}

export default ChessGame;