import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SiteIcon } from "@/components/site/SiteIcon";
import dynamic from "next/dynamic";

const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

interface Props {
  overlayOpen: boolean;
  cardOpen: boolean;
  onClose: () => void;
  store?: { id: string; name: string; url: string } | null;
  animationData: object | null;
}

export function SyncCelebrationDialog({ overlayOpen, cardOpen, onClose, store, animationData }: Props) {
  return (
    <>
      {overlayOpen && animationData && (
        <div className="fixed inset-0 pointer-events-none z-[60]">
          <Lottie
            animationData={animationData}
            loop={false}
            autoplay
            style={{ width: "100%", height: "100%" }}
          />
        </div>
      )}
      <Dialog open={cardOpen} onOpenChange={(v) => { if (!v) onClose(); }}>
        <DialogContent className="max-w-md rounded-2xl border-0 shadow-2xl bg-white p-0 overflow-hidden">
          <div className="px-8 py-10 text-center flex flex-col items-center gap-4">
            {store ? (
              <SiteIcon site={store} size={80} className="ring-4 ring-white shadow-lg" />
            ) : (
              <div className="text-6xl leading-none">🎉</div>
            )}
            <h2 className="text-2xl font-semibold text-foreground">Your site is ready!</h2>
            <p className="text-sm text-muted-foreground">
              Welcome aboard. To infinity and beyond 🚀
            </p>
            <Button
              size="lg"
              className="mt-2 px-8 rounded-full bg-orange-500 hover:bg-orange-600 text-white font-semibold"
              onClick={onClose}
            >
              Let&apos;s go →
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}