import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthProvider";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PlayCircle, AlertCircle } from "lucide-react";

const DISMISS_KEY = "resume-prompt-dismissed";

const HIDDEN_PREFIXES = ["/sites/connect", "/auth", "/sites/"];

export function IncompleteOnboardingPrompt() {
  const router = useRouter();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [sites, setSites] = useState<{ id: string; name: string }[]>([]);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    if (checked) return;
    const hidden = HIDDEN_PREFIXES.some((p) => router.pathname.startsWith(p));
    if (hidden) return;

    if (typeof window !== "undefined" && sessionStorage.getItem(DISMISS_KEY) === "1") {
      setChecked(true);
      return;
    }

    const run = async () => {
      const { data } = await supabase
        .from("stores")
        .select("id, name, onboarding_completed_at")
        .is("onboarding_completed_at", null)
        .order("created_at", { ascending: false })
        .limit(10);
      const incomplete = (data || []).map((s) => ({ id: s.id, name: s.name || "Untitled site" }));
      if (incomplete.length > 0) {
        setSites(incomplete);
        setOpen(true);
      }
      setChecked(true);
    };
    run();
  }, [user?.id, router.pathname, checked]);

  const handleResume = () => {
    const first = sites[0];
    if (!first) return;
    setOpen(false);
    router.push(`/sites/connect/${first.id}?resume=1`);
  };

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setOpen(false);
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleDismiss(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-warning" />
            <DialogTitle>Resume site setup?</DialogTitle>
          </div>
          <DialogDescription>
            You have {sites.length} site{sites.length === 1 ? "" : "s"} with setup in progress.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5 py-2 max-h-48 overflow-y-auto">
          {sites.map((s) => (
            <div key={s.id} className="text-sm px-3 py-2 rounded-md bg-muted/50 border border-border/60">
              {s.name}
            </div>
          ))}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleDismiss}>Not now</Button>
          <Button onClick={handleResume} className="gap-1.5">
            <PlayCircle className="h-4 w-4" />
            Resume {sites[0]?.name || "setup"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}