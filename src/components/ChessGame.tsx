import React, { useState, useCallback, useEffect } from 'react';
import { Chess } from 'chess.js';
import ChessBoard from './ChessBoard';

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

export function ChessGame() {
  const [game, setGame] = useState(() => new Chess());
  const [gameHistory, setGameHistory] = useState<Chess[]>([new Chess()]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
  const [moveHistory, setMoveHistory] = useState<string[]>([]);

  // Initialize the sample game
  useEffect(() => {
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
  }, []);

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
    console.log('Move made:', move);
  }, []);

  return (
    <section>
      <header>
        <h2>Kasparov vs Topalov, Wijk aan Zee 1999</h2>
        <p>"Kasparov's Immortal" - Navigate through this famous game</p>
      </header>
      
      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <ChessBoard 
            key={currentMoveIndex}
            game={game} 
            onMove={onMove}
            boardWidth={400}
            showCoordinates={true}
          />
        </div>
        
        <div style={{ minWidth: '300px' }}>
          <div style={{ marginBottom: '1rem' }}>
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
              ◀ Previous
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
              End ⏭
            </button>
          </div>
          
          <p><small>Move {currentMoveIndex} of {gameHistory.length - 1}</small></p>
          
          <details open>
            <summary>Move History</summary>
            <div style={{ maxHeight: '300px', overflowY: 'auto', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}>
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
                      backgroundColor: isCurrentMove ? '#007bff' : 'transparent',
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
      </div>
    </section>
  );
}

export default ChessGame;