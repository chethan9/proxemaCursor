import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useNotifications, type AppNotification } from "@/contexts/NotificationProvider";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SiteIcon } from "@/components/site/SiteIcon";
import { useToast } from "@/hooks/use-toast";
import { X, Megaphone, Trophy, Sparkles } from "lucide-react";

const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

const lottieCache = new Map<string, object>();

function useLottie(url: string | null) {
  const [data, setData] = useState<object | null>(url ? lottieCache.get(url) ?? null : null);
  useEffect(() => {
    if (!url) return;
    if (lottieCache.has(url)) { setData(lottieCache.get(url)!); return; }
    let cancelled = false;
    fetch(url).then((r) => r.json()).then((d) => {
      lottieCache.set(url, d);
      if (!cancelled) setData(d);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [url]);
  return data;
}

export function NotificationRenderer() {
  const { current, dismiss, click } = useNotifications();
  const { toast } = useToast();

  useEffect(() => {
    if (!current) return;
    if (current.type === "info" || current.type === "warning") {
      toast({
        title: current.title,
        description: current.body || undefined,
        variant: current.type === "warning" ? "destructive" : "default",
      });
      dismiss();
    }
  }, [current, dismiss, toast]);

  if (!current) return null;
  if (current.type === "celebration") return <CelebrationView n={current} onClose={dismiss} onClick={click} />;
  if (current.type === "announcement") return <AnnouncementView n={current} onClose={dismiss} onClick={click} />;
  if (current.type === "ad") return <AdBanner n={current} onClose={dismiss} onClick={click} />;
  if (current.type === "milestone") return <MilestoneView n={current} onClose={dismiss} onClick={click} />;
  return null;
}

function CelebrationView({ n, onClose, onClick }: { n: AppNotification; onClose: () => void; onClick: () => void }) {
  const lottie = useLottie(n.lottie_url || "/confetti.json");
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  const storeMeta = n.metadata as { store_id?: string; store_name?: string; store_url?: string; logo_url?: string };

  useEffect(() => {
    setOverlayOpen(true);
    const t = setTimeout(() => setCardOpen(true), 900);
    return () => clearTimeout(t);
  }, []);

  const handleClose = () => {
    setCardOpen(false);
    setOverlayOpen(false);
    setTimeout(() => {
      if (n.cta_url) { onClick(); } else { onClose(); }
    }, 400);
  };

  return (
    <>
      {overlayOpen && lottie && (
        <div className="fixed inset-0 pointer-events-none z-[60]">
          <Lottie animationData={lottie} loop={false} autoplay style={{ width: "100%", height: "100%" }} />
        </div>
      )}
      <Dialog open={cardOpen} onOpenChange={(v) => { if (!v) handleClose(); }}>
        <DialogContent className="max-w-md rounded-2xl border-0 shadow-2xl bg-white p-0 overflow-hidden">
          <div className="px-8 py-10 text-center flex flex-col items-center gap-4">
            {storeMeta.store_id && storeMeta.store_name && storeMeta.store_url ? (
              <SiteIcon
                site={{ id: storeMeta.store_id, name: storeMeta.store_name, url: storeMeta.store_url, logo_url: storeMeta.logo_url ?? null }}
                size={80}
                className="ring-4 ring-white shadow-lg"
              />
            ) : (
              <div className="text-6xl leading-none">🎉</div>
            )}
            <h2 className="text-2xl font-semibold text-foreground">{n.title}</h2>
            {n.body && <p className="text-sm text-muted-foreground">{n.body}</p>}
            <Button
              size="lg"
              className="mt-2 px-8 rounded-full bg-orange-500 hover:bg-orange-600 text-white font-semibold"
              onClick={handleClose}
            >
              {n.cta_label || "Let's go"} →
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AnnouncementView({ n, onClose, onClick }: { n: AppNotification; onClose: () => void; onClick: () => void }) {
  const lottie = useLottie(n.lottie_url);
  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg rounded-2xl border-0 shadow-2xl bg-white p-0 overflow-hidden">
        <div className="p-8 text-center flex flex-col items-center gap-4">
          {lottie ? (
            <div className="w-24 h-24"><Lottie animationData={lottie} loop autoplay /></div>
          ) : n.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={n.image_url} alt="" className="w-full max-h-64 object-contain rounded-lg" />
          ) : (
            <Sparkles className="h-10 w-10 text-primary" />
          )}
          <h2 className="text-xl font-semibold">{n.title}</h2>
          {n.body && <p className="text-sm text-muted-foreground whitespace-pre-line">{n.body}</p>}
          <div className="flex gap-2 mt-2">
            <Button variant="ghost" onClick={onClose}>Dismiss</Button>
            {n.cta_label && (
              <Button onClick={onClick}>{n.cta_label}</Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AdBanner({ n, onClose, onClick }: { n: AppNotification; onClose: () => void; onClick: () => void }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-xl border bg-card shadow-xl p-4 animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="flex gap-3">
        {n.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={n.image_url} alt="" className="w-12 h-12 rounded-lg object-cover" />
        ) : (
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Megaphone className="h-5 w-5 text-primary" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{n.title}</p>
          {n.body && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>}
          {n.cta_label && (
            <Button size="sm" variant="link" className="h-auto p-0 mt-1 text-xs" onClick={onClick}>
              {n.cta_label} →
            </Button>
          )}
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground shrink-0">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function MilestoneView({ n, onClose, onClick }: { n: AppNotification; onClose: () => void; onClick: () => void }) {
  const lottie = useLottie(n.lottie_url);
  const [open, setOpen] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => { setOpen(false); setTimeout(onClose, 300); }, 4500);
    return () => clearTimeout(t);
  }, [onClose]);
  if (!open) return null;
  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm rounded-xl border bg-card shadow-xl p-4 animate-in slide-in-from-top-4 fade-in duration-300">
      <div className="flex gap-3">
        <div className="w-12 h-12 shrink-0">
          {lottie ? <Lottie animationData={lottie} loop={false} autoplay /> : <Trophy className="h-10 w-10 text-amber-500" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">{n.title}</p>
          {n.body && <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>}
          {n.cta_label && (
            <Button size="sm" variant="link" className="h-auto p-0 mt-1 text-xs" onClick={onClick}>
              {n.cta_label} →
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}