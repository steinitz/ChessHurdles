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
export type EngineOptions = Record<string, string | number | boolean>;

export function initializeStockfishWorker(
  onMessage: (event: MessageEvent) => void,
  onError: (error: string) => void,
  engineOptions?: EngineOptions
): Worker | null {
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
    // Apply optional engine options for performance tuning
    if (engineOptions) {
      for (const [name, value] of Object.entries(engineOptions)) {
        try {
          worker.postMessage(`setoption name ${name} value ${String(value)}`);
        } catch (err) {
          console.warn(`Failed to set engine option ${name}:`, err);
        }
      }
    }

    // Auto-configure Threads to maximum hardware concurrency when safe.
    // Only set Threads when SharedArrayBuffer is available and the page is cross-origin isolated.
    // This avoids stalls when the Stockfish build or environment does not support WASM threads.
    try {
      const hasThreadsOption = !!(engineOptions && Object.prototype.hasOwnProperty.call(engineOptions, 'Threads'));
      const coi = (window as any).crossOriginIsolated === true;
      const sabAvailable = typeof SharedArrayBuffer !== 'undefined';
      const hw = (navigator as any).hardwareConcurrency || 1;
      console.info('[Stockfish] hardwareConcurrency:', hw);
      if (hasThreadsOption) {
        // Log the provided Threads value; user-configured value takes precedence
        // Note: ENGINE_DEFAULT_OPTIONS type allows string/number/boolean; convert to string for logging
        const provided = String((engineOptions as any).Threads);
        console.info('[Stockfish] Threads provided in ENGINE_DEFAULT_OPTIONS:', provided);
      } else {
        console.info('[Stockfish] COI:', coi, 'SAB available:', sabAvailable);
      }
      if (!hasThreadsOption && coi && sabAvailable) {
        const maxThreads = Math.max(1, hw);
        console.info('[Stockfish] Auto-configuring Threads to', maxThreads);
        worker.postMessage(`setoption name Threads value ${maxThreads}`);
      } else if (!hasThreadsOption) {
        console.info('[Stockfish] Auto Threads disabled (missing COI/SAB). Using single-threaded.');
      }
    } catch (err) {
      console.warn('Auto Threads configuration skipped:', err);
    }

    // Signal readiness after applying options
    try { worker.postMessage('isready'); } catch { }

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
    let start = Date.now();
    let resolved = false;
    let ready = false;

    const onMessage = (event: MessageEvent) => {
      const msg = String(event.data || '');
      // Wait for engine readiness if requested
      if (!ready && msg.includes('readyok')) {
        ready = true;
        // After ready, set position and start timer just before go
        try {
          worker.postMessage(`position fen ${fen}`);
          start = Date.now();
          worker.postMessage(`go depth ${depth}`);
        } catch { }
        return;
      }

      // Resolve on bestmove once search completes
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
      } catch { }
    };

    const timeout = setTimeout(() => {
      if (!resolved) {
        cleanup();
        reject(new Error('Calibration run timed out'));
      }
    }, timeoutMs);

    worker.addEventListener('message', onMessage as any);
    worker.addEventListener('error', onError as any);

    // Ensure clean state and check readiness before starting search
    try {
      worker.postMessage('stop');
      worker.postMessage('ucinewgame');
      // Ask engine to report readiness; proceed on 'readyok'
      ready = false;
      worker.postMessage('isready');
    } catch { }
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
  onProgress?: (depth: number, ms: number) => void;
}): Promise<number> {
  const { worker, fen, targetMs, minDepth = 1, maxDepth = 21, timeoutPerRunMs = 20000, onProgress } = options;
  if (!worker) throw new Error('Engine worker not available');

  // Probe across increasing integer depths with early stop on first overshoot
  let bestDepth = minDepth;
  let bestDiff = Number.POSITIVE_INFINITY;
  let lastUnder: { depth: number; ms: number } | null = null;

  for (let depth = Math.max(minDepth, 1); depth <= maxDepth; depth += 1) {
    let ms = 0;
    try {
      ms = await runDepthOnFen(worker, fen, depth, timeoutPerRunMs);
    } catch (e) {
      // If a run fails or times out, skip this depth
      continue;
    }

    if (typeof onProgress === 'function') {
      try { onProgress(depth, ms); } catch { }
    }

    const diff = Math.abs(ms - targetMs);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestDepth = depth;
    }

    if (ms <= targetMs) {
      if (!lastUnder || depth > lastUnder.depth) {
        lastUnder = { depth, ms };
      }
    } else {
      // First over-target timing encountered; stop further probing to avoid long runs
      break;
    }
  }

  const finalDepth = lastUnder ? lastUnder.depth : bestDepth;
  return Math.min(Math.max(finalDepth, minDepth), maxDepth);
}