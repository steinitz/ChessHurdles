import React from 'react';

interface ChessClockDisplayProps {
  timeMs: number;
  isActive: boolean;
  side: 'White' | 'Black';
  isLowTime?: boolean; // e.g. < 1 minute
  onClick?: () => void;
}

export function ChessClockDisplay({ timeMs, isActive, side, isLowTime, onClick }: ChessClockDisplayProps) {
  // Format time as MM:SS (or MM:SS.s if low?)
  // reliable MM:SS format
  const totalSeconds = Math.max(0, Math.floor(timeMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  const minutesStr = minutes.toString().padStart(2, '0');
  const secondsStr = seconds.toString().padStart(2, '0');

  // Simple clean aesthetic
  return (
    <div
      onClick={onClick}
      className={`
      flex items-center gap-2 px-4 py-2 rounded-md font-mono text-xl font-bold
      ${isActive ? 'bg-accent/10 border-2 border-accent' : 'bg-gray-100 border-2 border-transparent opacity-70'}
      ${isLowTime ? 'text-red-600' : 'text-primary'}
      ${onClick ? 'cursor-pointer hover:bg-accent/20 transition-colors' : ''}
      transition-all duration-200
    `}>
      <i className={`fas fa-clock ${isActive ? 'animate-pulse' : ''}`}></i>
      <span>{minutesStr}:{secondsStr}</span>
    </div>
  );
}
