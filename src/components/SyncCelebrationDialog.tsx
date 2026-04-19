import { useEffect } from "react";
import confetti from "canvas-confetti";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function SyncCelebrationDialog({ open, onOpenChange }: Props) {
  useEffect(() => {
    if (!open) return;
    const colors = ["#10b981", "#f59e0b", "#f43f5e", "#3b82f6", "#8b5cf6"];
    const duration = 3000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 4,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors,
        scalar: 0.9,
        gravity: 1,
      });
      confetti({
        particleCount: 4,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors,
        scalar: 0.9,
        gravity: 1,
      });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();

    confetti({
      particleCount: 80,
      spread: 90,
      origin: { x: 0.5, y: 0.5 },
      colors,
      scalar: 1.1,
    });
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl border-0 shadow-2xl bg-white p-0 overflow-hidden">
        <div className="px-8 py-10 text-center flex flex-col items-center gap-4">
          <div className="text-6xl leading-none">🎉</div>
          <h2 className="text-2xl font-semibold text-foreground">Your site is ready!</h2>
          <p className="text-sm text-muted-foreground">
            Welcome aboard. To infinity and beyond 🚀
          </p>
          <Button
            size="lg"
            className="mt-2 px-8 rounded-full bg-orange-500 hover:bg-orange-600 text-white font-semibold"
            onClick={() => onOpenChange(false)}
          >
            Let&apos;s go →
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}