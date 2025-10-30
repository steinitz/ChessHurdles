import React from 'react';
import PgnInput from '~/components/PgnInput';

interface GameLoadProps {
  onPgnLoad: (pgn: string) => void;
  onClear: () => void;
}

export function GameLoad({ onPgnLoad, onClear }: GameLoadProps) {
  return (
    <PgnInput onPgnLoad={onPgnLoad} onClear={onClear} />
  );
}

export default GameLoad;