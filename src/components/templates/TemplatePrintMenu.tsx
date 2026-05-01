import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Loader2, Receipt, FileText, Star, Sparkles, ChevronDown, Settings2 } from "lucide-react";
import { listTemplates, setDefaultForType } from "@/services/templateService";
import { resolveDefaultTemplateForPrint } from "@/lib/template-resolve-default";
import { useAuth } from "@/contexts/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import type { TemplateType } from "@/lib/templates/document";
import { buildOrderTemplatePdfUrl } from "@/lib/templates/order-template-pdf-url";
import Link from "next/link";

interface Props {
  storeId: string;
  orderId: string;
  type: Extract<TemplateType, "invoice" | "pickslip">;
  variant?: "default" | "outline" | "ghost";
  className?: string;
}

const META = {
  invoice: { label: "Invoice", Icon: Receipt },
  pickslip: { label: "Pick Slip", Icon: FileText },
} as const;

export function TemplatePrintMenu({ storeId, orderId, type, variant = "outline", className }: Props) {
  const { profile } = useAuth();
  const clientId = profile?.client_id ?? null;
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const meta = META[type];
  const Icon = meta.Icon;

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["templates", type],
    queryFn: () => listTemplates(type),
    staleTime: 30_000,
  });

  const defaultTpl = resolveDefaultTemplateForPrint(templates, type, clientId);

  const setDefault = useMutation({
    mutationFn: (id: string) => {
      if (!clientId) throw new Error("No client");
      return setDefaultForType(clientId, type, id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["templates"] });
      toast({ title: "Default updated" });
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const print = (id: string) => {
    const url = buildOrderTemplatePdfUrl(id, storeId, orderId);
    window.open(url, "_blank", "noopener");
    setOpen(false);
  };

  const printDefault = () => {
    if (defaultTpl) print(defaultTpl.id);
    else toast({ title: "No template available", description: `Create a ${meta.label.toLowerCase()} template first`, variant: "destructive" });
  };

  const customs = templates.filter((t) => !t.is_sample && t.client_id === clientId);
  const samples = templates.filter((t) => t.is_sample);

  return (
    <div className={`inline-flex ${className ?? ""}`}>
      <Button variant={variant} size="sm" onClick={printDefault} className="rounded-r-none border-r-0 gap-1.5">
        <Icon className="h-3.5 w-3.5" /> {meta.label}
      </Button>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant={variant} size="sm" className="rounded-l-none px-1.5">
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">Choose {meta.label.toLowerCase()}</DropdownMenuLabel>
          {isLoading && (
            <div className="px-2 py-3 text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> Loading…</div>
          )}
          {!isLoading && customs.length > 0 && (
            <>
              {customs.map((t) => (
                <DropdownMenuItem key={t.id} onClick={() => print(t.id)} className="gap-2">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="flex-1 truncate">{t.name}</span>
                  {t.is_default_for_type && <Star className="h-3 w-3 fill-amber-500 text-amber-500" />}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
            </>
          )}
          {!isLoading && samples.length > 0 && (
            <>
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Sparkles className="h-2.5 w-2.5" /> Samples</DropdownMenuLabel>
              {samples.map((t) => (
                <DropdownMenuItem key={t.id} onClick={() => print(t.id)} className="gap-2">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="flex-1 truncate">{t.name}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
            </>
          )}
          {(customs.length > 0 || samples.length > 0) && (
            <>
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">Set as default</DropdownMenuLabel>
              {samples.map((t) => (
                <DropdownMenuItem key={`def-sample-${t.id}`} onClick={(e) => { e.preventDefault(); setDefault.mutate(t.id); }} className="gap-2 text-xs" disabled={t.is_default_for_type}>
                  <Star className={`h-3 w-3 ${t.is_default_for_type ? "fill-amber-500 text-amber-500" : "text-muted-foreground"}`} />
                  <span className="flex-1 truncate">{t.name}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">Sample</span>
                </DropdownMenuItem>
              ))}
              {customs.map((t) => (
                <DropdownMenuItem key={`def-${t.id}`} onClick={(e) => { e.preventDefault(); setDefault.mutate(t.id); }} className="gap-2 text-xs" disabled={t.is_default_for_type}>
                  <Star className={`h-3 w-3 ${t.is_default_for_type ? "fill-amber-500 text-amber-500" : "text-muted-foreground"}`} />
                  <span className="flex-1 truncate">{t.name}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
            </>
          )}
          <Link href={`/templates?type=${type}`} className="block">
            <DropdownMenuItem className="gap-2 text-xs"><Settings2 className="h-3 w-3" /> Manage templates</DropdownMenuItem>
          </Link>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}