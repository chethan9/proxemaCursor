import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Megaphone, Trophy, Sparkles, Info, AlertTriangle } from "lucide-react";
import type { NotificationType } from "@/services/notificationAdminService";

const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

interface Props {
  type: NotificationType;
  title: string;
  body?: string;
  cta_label?: string;
  image_url?: string;
  lottie_url?: string;
}

export function NotificationPreview({ type, title, body, cta_label, image_url, lottie_url }: Props) {
  const [lottie, setLottie] = useState<object | null>(null);
  useEffect(() => {
    if (!lottie_url && type !== "celebration") return;
    const url = lottie_url || "/confetti.json";
    fetch(url).then((r) => r.json()).then(setLottie).catch(() => {});
  }, [lottie_url, type]);

  const safeTitle = title || "Your title here";
  const safeBody = body || "Body text preview appears here as you type.";
  const safeCta = cta_label || "Action";

  if (type === "celebration") {
    return (
      <div className="rounded-2xl border bg-white p-8 text-center flex flex-col items-center gap-4 relative overflow-hidden shadow-sm">
        {lottie && <div className="absolute inset-0 pointer-events-none opacity-70"><Lottie animationData={lottie} loop={false} autoplay /></div>}
        <div className="relative text-5xl">🎉</div>
        <h3 className="relative text-xl font-semibold">{safeTitle}</h3>
        <p className="relative text-sm text-muted-foreground">{safeBody}</p>
        <Button className="relative rounded-full bg-orange-500 hover:bg-orange-600 text-white px-6">{safeCta} →</Button>
      </div>
    );
  }

  if (type === "announcement") {
    return (
      <div className="rounded-2xl border bg-white p-6 text-center flex flex-col items-center gap-3 shadow-sm">
        {lottie ? <div className="w-20 h-20"><Lottie animationData={lottie} loop autoplay /></div> :
          image_url ? <img src={image_url} alt="" className="max-h-40 rounded-lg" /> :
          <Sparkles className="h-8 w-8 text-primary" />}
        <h3 className="text-lg font-semibold">{safeTitle}</h3>
        <p className="text-sm text-muted-foreground whitespace-pre-line">{safeBody}</p>
        <div className="flex gap-2"><Button variant="ghost" size="sm">Dismiss</Button><Button size="sm">{safeCta}</Button></div>
      </div>
    );
  }

  if (type === "ad") {
    return (
      <div className="rounded-xl border bg-card shadow-lg p-4 max-w-sm">
        <div className="flex gap-3">
          {image_url ? <img src={image_url} alt="" className="w-12 h-12 rounded-lg object-cover" /> :
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"><Megaphone className="h-5 w-5 text-primary" /></div>}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{safeTitle}</p>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{safeBody}</p>
            <Button size="sm" variant="link" className="h-auto p-0 mt-1 text-xs">{safeCta} →</Button>
          </div>
          <X className="h-4 w-4 text-muted-foreground shrink-0" />
        </div>
      </div>
    );
  }

  if (type === "milestone") {
    return (
      <div className="rounded-xl border bg-card shadow-lg p-4 max-w-sm">
        <div className="flex gap-3">
          <div className="w-12 h-12 shrink-0">
            {lottie ? <Lottie animationData={lottie} loop={false} autoplay /> : <Trophy className="h-10 w-10 text-amber-500" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">{safeTitle}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{safeBody}</p>
          </div>
        </div>
      </div>
    );
  }

  // info / warning (toast-style)
  const isWarn = type === "warning";
  return (
    <div className={`rounded-lg border p-4 max-w-sm ${isWarn ? "bg-destructive/5 border-destructive/30" : "bg-card"}`}>
      <div className="flex gap-3">
        {isWarn ? <AlertTriangle className="h-5 w-5 text-destructive shrink-0" /> : <Info className="h-5 w-5 text-primary shrink-0" />}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">{safeTitle}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{safeBody}</p>
        </div>
      </div>
    </div>
  );
}