import { useEffect } from "react";

interface ConfettiBurstProps {
  active: boolean;
  duration?: number;
}

/**
 * Triggers a short confetti burst using canvas-confetti when `active` becomes true.
 */
export function ConfettiBurst({ active, duration = 2000 }: ConfettiBurstProps) {
  useEffect(() => {
    if (!active) return;

    let animationFrameId: number | null = null;
    let cancelled = false;

    const runConfetti = async () => {
      try {
        const mod = await import("canvas-confetti");
        if (cancelled) return;

        const confetti = mod.default;
        const end = Date.now() + duration;
        const colors = ["#F97316", "#2563EB", "#10B981", "#FACC15", "#EC4899"];

        const frame = () => {
          confetti({
            particleCount: 70,
            spread: 70,
            origin: { x: 0.2, y: 0.2 },
            colors,
          });
          confetti({
            particleCount: 70,
            spread: 70,
            origin: { x: 0.8, y: 0.2 },
            colors,
          });

          if (Date.now() < end) {
            animationFrameId = requestAnimationFrame(frame);
          }
        };

        frame();
      } catch (error) {
        console.error("Konfetti konnte nicht geladen werden", error);
      }
    };

    runConfetti();

    return () => {
      cancelled = true;
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [active, duration]);

  return null;
}

export default ConfettiBurst;
