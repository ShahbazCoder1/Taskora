import confetti from 'canvas-confetti';

/**
 * Trigger an energetic, celebratory confetti burst when a task is completed.
 * Uses vibrant theme-matching particles with multi-angle spreads.
 */
export function triggerTaskDoneConfetti() {
  if (typeof window === 'undefined') return;

  try {
    const colors = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#3b82f6', '#8b5cf6', '#14b8a6'];

    // Left cannon burst
    confetti({
      particleCount: 45,
      angle: 60,
      spread: 55,
      origin: { x: 0.2, y: 0.75 },
      colors,
      zIndex: 9999,
      startVelocity: 40,
      disableForReducedMotion: true,
    });

    // Right cannon burst
    confetti({
      particleCount: 45,
      angle: 120,
      spread: 55,
      origin: { x: 0.8, y: 0.75 },
      colors,
      zIndex: 9999,
      startVelocity: 40,
      disableForReducedMotion: true,
    });

    // Center sparkling pop
    setTimeout(() => {
      confetti({
        particleCount: 30,
        spread: 80,
        origin: { x: 0.5, y: 0.65 },
        colors,
        zIndex: 9999,
        startVelocity: 35,
        scalar: 1.1,
        disableForReducedMotion: true,
      });
    }, 120);
  } catch (err) {
    console.warn('Confetti effect error:', err);
  }
}
