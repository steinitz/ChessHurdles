import React, { useState, useCallback } from 'react';
import { Chess } from 'chess.js';
import { useSession } from '~stzUser/lib/auth-client';
import { saveGame } from '~/lib/server/games';
import { saveHurdle } from '~/lib/server/hurdles';

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
  onGameSaved?: (gameId: string) => void;
  onHurdleSaved?: () => void;
}

export default function GameSaver({
  game,
  gameMoves,
  gameTitle,
  gameDescription,
  currentMoveIndex,
  onGameSaved,
  onHurdleSaved
}: GameSaverProps) {
  const { data: session } = useSession();
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [savedGameId, setSavedGameId] = useState<string | null>(null);



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
      // We only support creating new games for now in this refactor
      // Update logic would need gameId passed in props or state

      const response = await saveGame({
        data: {
          pgn: pgn,
          white: 'White', // TODO: Extract from game
          black: 'Black', // TODO: Extract from game
          result: '*',    // TODO: Extract from game
          date: new Date().toISOString()
        }
      });

      if (!response) {
        throw new Error('Failed to save game');
      }

      result = response;
      setSavedGameId(result.id);
      setSaveMessage('Game saved successfully!');

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
      // For a hurdle, we want the position BEFORE the move was played
      const preMovePosition = gameMoves[currentMoveIndex - 1]?.position.fen() || game.fen();
      const currentMove = gameMoves[currentMoveIndex]?.move;

      await saveHurdle({
        data: {
          gameId: savedGameId || undefined,
          fen: preMovePosition,
          title: `${gameTitle} - Move ${currentMoveIndex}`,
          moveNumber: currentMoveIndex,
          evaluation: undefined,
          bestMove: undefined,
          playedMove: currentMove,
          centipawnLoss: undefined,
          aiDescription: `Position after ${currentMove}`,
          depth: undefined,
          difficultyLevel: undefined
        }
      });

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
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <button
            onClick={handleSaveGame}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Game'}
          </button>
          <div style={{ width: '1rem', minWidth: '1rem' }} /> {/* Fixed spacer */}
          <button
            onClick={handleSaveHurdle}
            disabled={isSaving || currentMoveIndex === 0}
          >
            {isSaving ? 'Saving...' : 'Save Position as Hurdle'}
          </button>
          {saveMessage && (
            <>
              <div style={{ width: '1rem', minWidth: '1rem' }} />
              <span style={{
                color: saveMessage.includes('Failed') || saveMessage.includes('Please sign in')
                  ? 'red'
                  : 'green',
                fontSize: '14px'
              }}>
                {saveMessage}
              </span>
            </>
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
