/**
 * Unified Motion System for Enterprise HR Mobile App
 * Grounded in 60fps motion architecture principles:
 * - Feedback: Instant tactile feedback on touches and toggles
 * - Change: Layout reordering, tab selection, filter switches
 * - Arrival: Sheet presentation, screen entry, card reveals
 * - Emphasis: Punch completion, approval success, pulse confirmations
 */

export const Motion = {
  spring: {
    feedback: {
      damping: 20,
      stiffness: 300,
      mass: 0.8,
    },
    change: {
      damping: 18,
      stiffness: 180,
      mass: 1.0,
    },
    arrival: {
      damping: 22,
      stiffness: 220,
      mass: 1.0,
    },
    emphasis: {
      damping: 12,
      stiffness: 140,
      mass: 0.9,
    },
    bouncy: {
      damping: 10,
      stiffness: 200,
      mass: 0.8,
    },
  },

  timing: {
    instant: 120,
    quick: 200,
    normal: 350,
    deliberate: 500,
    holdToPunch: 650,
  },

  scale: {
    pressed: 0.96,
    subtle: 0.98,
    active: 1.0,
    expanded: 1.04,
  },
} as const;

export type MotionTokens = typeof Motion;
