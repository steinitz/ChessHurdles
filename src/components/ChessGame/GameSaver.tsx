import React, { useState, useCallback } from 'react';
import { Chess } from 'chess.js';
import { useSession } from '~stzUser/lib/auth-client';

interface GameMove {
  position: Chess;
  move?: string;
  moveNumber?: number;
  isWhiteMove?: boolean;
}

interface GameSaverProps {
  game: Chess;
  gameMoves: GameMove[];
  gameTitle: string;
  gameDescription: string;
  currentMoveIndex: number;
}

export function GameSaver({ 
  game, 
  gameTitle, 
  gameDescription, 
  gameMoves, 
  currentMoveIndex 
}: GameSaverProps) {
  const { data: session } = useSession();
  const [savedGameId, setSavedGameId] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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
        evaluation: null,
        best_move: null,
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
  }, [session?.user?.id, game, gameTitle, currentMoveIndex, gameMoves, savedGameId]);

  return (
    <div>
      {/* Save functionality section */}
      {session?.user ? (
        <div style={{ 
          display: 'flex', 
          gap: '10px', 
          alignItems: 'center',
          marginBottom: '10px'
        }}>
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
                ? 'red' 
                : 'green',
              fontSize: '14px'
            }}>
              {saveMessage}
            </span>
          )}
        </div>
      ) : (
        <div style={{ 
          padding: '10px', 
          backgroundColor: '#f0f0f0', 
          borderRadius: '4px',
          marginBottom: '10px'
        }}>
          <a href="/auth/signin">Sign in</a> to save games and positions
        </div>
      )}
    </div>
  );
}

export default GameSaver;