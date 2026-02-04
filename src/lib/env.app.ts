import { clientEnv as upstreamEnv, type ClientEnv as UpstreamClientEnv } from '~stzUser/lib/env';

export type AppClientEnv = UpstreamClientEnv & {
  AI_WORTHY_THRESHOLD: number;
  COST_AI_EXPLANATION: number;
  COST_SAVE_GAME: number;
};

// Extend the upstream client environment with application-specific variables
// We merge upstream values (which handle window.__ENV hydration) with our local process.env lookups
export const clientEnv: AppClientEnv = {
  ...upstreamEnv,
  // Application specific overrides
  AI_WORTHY_THRESHOLD: Number(process.env.AI_WORTHY_THRESHOLD || '0.15'),
  COST_AI_EXPLANATION: Number(process.env.COST_AI_EXPLANATION || '15'),
  COST_SAVE_GAME: Number(process.env.COST_SAVE_GAME || '1'),

  // Robustness: ensure we pick up any runtime injection for these specific keys if available
  // (Note: Upstream handle generic keys, we must handle ours if they are injected via window.__ENV)
  ...(typeof window !== 'undefined' && window.__ENV ? {
    // We cast window.__ENV to any because upstream types don't know about these keys yet
    AI_WORTHY_THRESHOLD: (window.__ENV as any).AI_WORTHY_THRESHOLD ?? Number(process.env.AI_WORTHY_THRESHOLD || '0.15'),
    COST_AI_EXPLANATION: (window.__ENV as any).COST_AI_EXPLANATION ?? Number(process.env.COST_AI_EXPLANATION || '15'),
    COST_SAVE_GAME: (window.__ENV as any).COST_SAVE_GAME ?? Number(process.env.COST_SAVE_GAME || '1'),
  } : {})
};
