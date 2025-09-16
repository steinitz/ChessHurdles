import React, { useState } from 'react';
import { parsePgn } from '../lib/chess-utils';

interface PgnInputProps {
  onPgnLoad: (pgnString: string) => void;
  onClear: () => void;
}

export function PgnInput({ onPgnLoad, onClear }: PgnInputProps) {
  const [pgnText, setPgnText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!pgnText.trim()) {
      setError('Please enter a PGN string');
      return;
    }

    setIsLoading(true);
    setError(null);

    // Validate PGN
    const parseResult = parsePgn(pgnText);
    
    if (!parseResult.isValid) {
      setError(parseResult.error || 'Invalid PGN format');
      setIsLoading(false);
      return;
    }

    // Success - load the game
    onPgnLoad(pgnText);
    setIsLoading(false);
  };

  const handleClear = () => {
    setPgnText('');
    setError(null);
    onClear();
  };

  return (
    <div style={{ marginBottom: '1rem', padding: '1rem', border: '1px solid var(--color-bg-secondary)', borderRadius: '4px' }}>
      <h3>Load Game from PGN</h3>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '0.5rem' }}>
          <textarea
            value={pgnText}
            onChange={(e) => setPgnText(e.target.value)}
            placeholder="Paste PGN here...\n\nExample:\n1.e4 e5 2.Nf3 Nc6 3.Bb5 a6"
            rows={6}
            style={{ 
              width: '100%', 
              fontFamily: 'monospace',
              fontSize: '0.9rem',
              resize: 'vertical'
            }}
          />
        </div>
        
        {error && (
          <p style={{ color: 'var(--color-error)', fontSize: '0.9rem', margin: '0.5rem 0' }}>
            Error: {error}
          </p>
        )}
        
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            type="submit" 
            disabled={isLoading || !pgnText.trim()}
          >
            {isLoading ? 'Loading...' : 'Load Game'}
          </button>
          <button 
            type="button" 
            onClick={handleClear}
            disabled={isLoading}
          >
            Clear & Use Sample Game
          </button>
        </div>
      </form>
    </div>
  );
}

export default PgnInput;