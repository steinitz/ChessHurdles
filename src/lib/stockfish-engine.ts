import { uciToAlgebraic, formatPrincipalVariation, formatMoveWithNumber } from './chess-utils';

// Types
interface MutableRefObject<T> {
  current: T;
}

export interface EngineEvaluation {
  evaluation: number;
  bestMove: string;
  principalVariation: string;
  depth: number;
  calculationTime: number;
}

export interface EngineCallbacks {
  setEvaluation: (evaluation: EngineEvaluation) => void;
  setIsAnalyzing: (analyzing: boolean) => void;
  onEvaluation?: (evaluation: number, bestMove: string, pv: string) => void;
  onCalculationTime?: (timeMs: number) => void;
}

// Message parsing functions
export function parseUciOkMessage(message: string): boolean {
  return message.includes('uciok');
}

export function parseDepthInfo(message: string) {
  if (!message.includes('info depth')) return null;
  
  const depthMatch = message.match(/depth (\d+)/);
  const scoreMatch = message.match(/score cp (-?\d+)/) || message.match(/score mate (-?\d+)/);
  const pvMatch = message.match(/\bpv ([a-h1-8qrnbk\s]+)/i);
  
  if (!depthMatch || !scoreMatch) return null;
  
  return {
    depth: parseInt(depthMatch[1]),
    score: parseInt(scoreMatch[1]),
    pv: pvMatch ? pvMatch[1].trim() : '',
    isMate: scoreMatch[0].includes('mate')
  };
}

export function parseBestMoveMessage(message: string): boolean {
  return message.includes('bestmove');
}

// Message handling functions
/**
 * Processes UCI messages from Stockfish engine and updates evaluation state.
 * 
 * **Message Flow**: This function is automatically called by the Web Worker's 'message' event
 * handler (set up in initializeStockfishWorker). When Stockfish sends any message, the worker
 * triggers the onMessage callback, which calls this function with the message content.
 * 
 * Handles three types of UCI messages:
 * • uciok - Engine initialization confirmation
 * • info depth X ... - Ongoing analysis updates with evaluation, depth, and principal variation
 * • bestmove - Analysis completion signal
 * 
 * Converts UCI notation to algebraic notation and formats principal variations.
 */
export function handleEngineMessage(
  message: string,
  depth: number,
  startTime: number,
  analyzingFen: string,
  callbacks: EngineCallbacks
): void {
  if (parseUciOkMessage(message)) {
    // Engine is ready
    console.log('Stockfish engine initialized');
  } else {
    const depthInfo = parseDepthInfo(message);
    if (depthInfo) {
      // Only update if we've reached the target depth or higher
      if (depthInfo.depth >= depth) {
        console.log('Engine message (target depth reached):', message);
        const calculationTime = Date.now() - startTime;
        
        // Extract the first move from the principal variation and convert to algebraic
        // PV format from Stockfish is UCI notation: "f4d6 d8d6 a5b3 a8d5..."
        const firstMoveUci = depthInfo.pv.split(' ')[0] || '';
        const firstMoveAlgebraic = firstMoveUci ? uciToAlgebraic(firstMoveUci, analyzingFen) || firstMoveUci : '';
        const bestMoveFormatted = firstMoveAlgebraic ? formatMoveWithNumber(firstMoveAlgebraic, analyzingFen) : '';
        
        // Convert the entire principal variation to algebraic notation
        const pvAlgebraic = formatPrincipalVariation(depthInfo.pv, analyzingFen);
        
        // Stockfish reports scores from the perspective of the side to move.
        // Normalize evaluations so that positive values always indicate an advantage for White.
        const isWhiteToMove = analyzingFen.split(' ')[1] === 'w';

        // Encode mate scores compatibly with UI components: base 5000 + mate distance
        // Keep the sign from side-to-move, then normalize to White perspective
        const sideSignedEval = depthInfo.isMate
          ? (depthInfo.score > 0 ? (5000 + Math.abs(depthInfo.score)) : -(5000 + Math.abs(depthInfo.score)))
          : depthInfo.score;

        const normalizedEval = isWhiteToMove ? sideSignedEval : -sideSignedEval;

        const newEvaluation: EngineEvaluation = {
          evaluation: normalizedEval,
          bestMove: bestMoveFormatted,
          principalVariation: pvAlgebraic,
          depth: depthInfo.depth,
          calculationTime
        };
        
        callbacks.setEvaluation(newEvaluation);
        
        if (callbacks.onEvaluation) {
          callbacks.onEvaluation(newEvaluation.evaluation, newEvaluation.bestMove, newEvaluation.principalVariation);
        }
        
        if (callbacks.onCalculationTime) {
          callbacks.onCalculationTime(calculationTime);
        }
      }
    } else if (parseBestMoveMessage(message)) {
      // Analysis complete
      console.log('Engine message (analysis complete):', message);
      callbacks.setIsAnalyzing(false);
      const calculationTime = Date.now() - startTime;
      
      if (callbacks.onCalculationTime) {
        callbacks.onCalculationTime(calculationTime);
      }
    }
  }
}

// Worker management functions
export function initializeStockfishWorker(onMessage: (event: MessageEvent) => void, onError: (error: string) => void): Worker | null {
  try {
    // Check if we're in a browser environment
    if (typeof window === 'undefined') return null;

    // Create worker with stockfish.js
    const wasmSupported = typeof WebAssembly === 'object' && 
      WebAssembly.validate(Uint8Array.of(0x0, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00));
    
    // Load stockfish.js from the public directory
    const worker = new Worker('/stockfish.js');
    
    worker.addEventListener('message', onMessage);
    worker.addEventListener('error', (e) => {
      console.error('Stockfish worker error:', e);
      onError('Engine initialization failed');
    });

    // Initialize UCI protocol
    worker.postMessage('uci');
    
    return worker;
  } catch (err) {
    console.error('Failed to initialize Stockfish:', err);
    onError('Failed to initialize chess engine');
    return null;
  }
}

export function cleanupWorker(worker: Worker | null): void {
  if (worker) {
    worker.terminate();
  }
}

// Analysis functions
export function analyzePosition(
  worker: Worker | null,
  fen: string,
  depth: number,
  isAnalyzing: boolean,
  setIsAnalyzing: (analyzing: boolean) => void,
  setError: (error: string | null) => void,
  startTimeRef: MutableRefObject<number>,
  analyzingFenRef: MutableRefObject<string>
): void {
  if (!worker || isAnalyzing) return;
  
  setIsAnalyzing(true);
  setError(null);
  startTimeRef.current = Date.now();
  
  // Set position and start analysis
  // Store the FEN being analyzed for move conversion
  analyzingFenRef.current = fen;
  // Send 'stop' first to ensure clean state, then set new position
  worker.postMessage('stop');
  worker.postMessage('ucinewgame');
  worker.postMessage(`position fen ${fen}`);
  worker.postMessage(`go depth ${depth}`);
}

export function stopAnalysis(
  worker: Worker | null,
  isAnalyzing: boolean,
  setIsAnalyzing: (analyzing: boolean) => void
): void {
  if (worker && isAnalyzing) {
    worker.postMessage('stop');
    setIsAnalyzing(false);
  }
}

// Calibration helpers
/**
 * Runs Stockfish on a single FEN to a fixed depth and resolves
 * with elapsed time in ms when the engine emits `bestmove`.
 * This does not touch React state and can be used for calibration.
 */
export async function runDepthOnFen(
  worker: Worker | null,
  fen: string,
  depth: number,
  timeoutMs: number = 20000
): Promise<number> {
  return new Promise((resolve, reject) => {
    if (!worker) return reject(new Error('Engine worker not available'));

    const start = Date.now();
    let resolved = false;

    const onMessage = (event: MessageEvent) => {
      const msg = String(event.data || '');
      if (parseBestMoveMessage(msg)) {
        const elapsed = Date.now() - start;
        cleanup();
        resolved = true;
        resolve(elapsed);
      }
    };

    const onError = (e: any) => {
      cleanup();
      reject(new Error('Engine error during calibration'));
    };

    const cleanup = () => {
      try {
        worker.removeEventListener('message', onMessage as any);
        worker.removeEventListener('error', onError as any);
        worker.postMessage('stop');
      } catch {}
    };

    const timeout = setTimeout(() => {
      if (!resolved) {
        cleanup();
        reject(new Error('Calibration run timed out'));
      }
    }, timeoutMs);

    worker.addEventListener('message', onMessage as any);
    worker.addEventListener('error', onError as any);

    // Ensure clean state and run to target depth
    worker.postMessage('stop');
    worker.postMessage('ucinewgame');
    worker.postMessage(`position fen ${fen}`);
    worker.postMessage(`go depth ${depth}`);
  });
}

/**
 * Calibrates a recommended analysis depth by running increasing depths
 * on a test position until the elapsed time is near targetMs.
 * Returns the depth closest to targetMs, clamped to min/max.
 */
export async function calibrateDepth(options: {
  worker: Worker | null;
  fen: string;
  targetMs: number;
  minDepth?: number;
  maxDepth?: number;
  timeoutPerRunMs?: number;
}): Promise<number> {
  const { worker, fen, targetMs, minDepth = 1, maxDepth = 21, timeoutPerRunMs = 20000 } = options;
  if (!worker) throw new Error('Engine worker not available');

  // Progressive probing depths (favor even steps as Stockfish often scales well)
  const candidates: number[] = [];
  for (let d = Math.max(2, minDepth); d <= maxDepth; d += 2) candidates.push(d);
  if (!candidates.includes(maxDepth)) candidates.push(maxDepth);

  let bestDepth = Math.max(minDepth, 2);
  let bestDiff = Number.POSITIVE_INFINITY;
  let lastUnder: { depth: number; ms: number } | null = null;
  let firstOver: { depth: number; ms: number } | null = null;

  for (const depth of candidates) {
    let ms = 0;
    try {
      ms = await runDepthOnFen(worker, fen, depth, timeoutPerRunMs);
    } catch (e) {
      // If a run fails or times out, skip this depth
      continue;
    }

    const diff = Math.abs(ms - targetMs);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestDepth = depth;
    }

    if (ms < targetMs) {
      lastUnder = { depth, ms };
    } else if (!firstOver) {
      firstOver = { depth, ms };
      // When we first cross target, we can stop early
      break;
    }
  }

  // If we overshot, prefer nearer of lastUnder vs firstOver
  if (lastUnder && firstOver) {
    const underDiff = Math.abs(lastUnder.ms - targetMs);
    const overDiff = Math.abs(firstOver.ms - targetMs);
    bestDepth = underDiff <= overDiff ? lastUnder.depth : firstOver.depth;
  }

  return Math.min(Math.max(bestDepth, minDepth), maxDepth);
}