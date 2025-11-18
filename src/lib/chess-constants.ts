// Centralized thresholds for centipawn loss classification
// Keep these values in one place to ensure consistency across UI and tests.

export const CP_LOSS_THRESHOLDS = {
  inaccuracy: 50,
  mistake: 150,
  blunder: 300,
} as const;