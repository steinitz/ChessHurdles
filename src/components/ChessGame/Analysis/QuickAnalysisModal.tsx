import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Chess } from 'chess.js';
import { useAnalysisEngine } from '~/components/ChessGame/Analysis/useAnalysisEngine';
import { getAIDescription } from '~/lib/chess-server';
import { DEFAULT_ANALYSIS_DEPTH } from '~/lib/chess-constants';
import { HelpTooltip } from '~/components/ui/HelpTooltip';

interface QuickAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  fen: string;
  move?: string; // The move that led to this position (optional)
}

export function QuickAnalysisModal({ isOpen, onClose, fen, move }: QuickAnalysisModalProps) {
  const [userContext, setUserContext] = useState('');
  const [analysisResult, setAnalysisResult] = useState<{ evaluation: number; bestMove: string; pv: string } | null>(null);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isEngineAnalyzing, setIsEngineAnalyzing] = useState(false);

  // Parse FEN to Chess object for engine
  const positionRef = useRef<any>(null); // We need a Chess instance, but importing Chess constructor might be tricky if not consistent.
  // Actually useAnalysisEngine expects `Chess[]`.
  // Let's dynamically import or simpler: The hook expects `Chess` objects.
  // We can just construct a lightweight object or import { Chess } from 'chess.js'

  // We'll use a mocked position object if we can't import Chess easily, but we should import it.
  // Check imports in GameAnalysis: `import type { Chess } from 'chess.js';`
  // We need the constructor.

  // Workaround: We will use a useEffect to load the engine analysis
  // But wait, `useAnalysisEngine` needs `Chess` objects to call `.fen()` on them?
  // Inspecting `useAnalysisEngine`: `nextPosition.fen()` is called.
  // So yes, we need an object with `.fen()`.

  const pseudoPosition = React.useMemo(() => ({
    fen: () => fen
  }), [fen]);

  const { startAnalysis, cancelAnalysis } = useAnalysisEngine({
    onProgress: () => { },
    onEvaluation: (index, evalData) => {
      setAnalysisResult({
        evaluation: evalData.evaluation,
        bestMove: evalData.bestMove,
        pv: evalData.principalVariation
      });
    },
    onComplete: () => setIsEngineAnalyzing(false),
    onAnalysisStatusChange: setIsEngineAnalyzing
  });

  useEffect(() => {
    if (isOpen && fen) {
      // Reset state
      setAnalysisResult(null);
      setAiResponse(null);
      setUserContext('');

      // Start Analysis
      // We pass "1" as full move number (dummy)
      startAnalysis(
        [move || 'current'], // Dummy move label
        [pseudoPosition],
        [1],
        DEFAULT_ANALYSIS_DEPTH
      );
    }
    return () => {
      cancelAnalysis();
    };
  }, [isOpen, fen, move, startAnalysis, cancelAnalysis, pseudoPosition]);

  const handleAskAI = async () => {
    if (!analysisResult) return;
    setIsAiLoading(true);
    try {
      const response = await getAIDescription({
        data: {
          fen,
          move: move || 'Unknown',
          evaluation: analysisResult.evaluation,
          bestMove: analysisResult.bestMove,
          pv: analysisResult.pv,
          centipawnLoss: 0, // Not calculated for single pos
          userContext: userContext
        }
      });
      if (response?.description) {
        setAiResponse(response.description);
      }
    } catch (e) {
      setAiResponse("Error fetching AI response.");
      console.error(e);
    } finally {
      setIsAiLoading(false);
    }
  };

  if (!isOpen) return null;

  const evalDisplay = analysisResult
    ? `${(analysisResult.evaluation / 100).toFixed(2)}`
    : 'Analyzing...';

  return (
    <dialog open style={{
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      zIndex: 2000,
      padding: '2rem',
      border: '1px solid var(--color-bg-secondary)',
      borderRadius: '8px',
      background: 'var(--color-bg)',
      color: 'var(--color-text)',
      minWidth: '400px',
      maxWidth: '90vw'
    }}>
      <header style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>Analysis</h3>
        <button onClick={onClose} style={{ padding: '0.2rem 0.6rem', fontSize: '1rem' }}>X</button>
      </header>

      <div style={{ marginBottom: '1rem' }}>
        <strong>Current Move:</strong> {move || 'Current Position'}<br />
        <strong>Engine Eval:</strong> {evalDisplay}<br />
        <strong>Best Move:</strong> {analysisResult?.bestMove || '...'}<br />
        <strong>Engine Line:</strong> <span style={{ fontFamily: 'monospace', fontSize: '0.9em' }}>{analysisResult?.pv || '...'}</span>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
          Ask the Coach a Question:
          <HelpTooltip content="Your question will be sent to the AI along with the position analysis." />
        </label>
        <textarea
          value={userContext}
          onChange={(e) => setUserContext(e.target.value)}
          placeholder="E.g., Why is my move bad? What is the plan here?"
          rows={3}
          style={{ width: '100%' }}
        />
      </div>

      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
        <button
          onClick={handleAskAI}
          disabled={!analysisResult || isAiLoading}
          className="btn-primary"
        >
          {isAiLoading ? 'Asking...' : 'Ask AI Coach'}
        </button>
      </div>

      {aiResponse && (
        <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--color-bg-secondary)', borderRadius: '4px' }}>
          <strong>Coach:</strong>
          <p style={{ marginTop: '0.5rem', whiteSpace: 'pre-wrap' }}>{aiResponse}</p>
        </div>
      )}
    </dialog>
  );
}
