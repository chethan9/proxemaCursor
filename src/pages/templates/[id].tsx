import { useState, useEffect, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AuthGuard } from "@/components/AuthGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Save, Pencil, Loader2, RefreshCw, Star, Code2, Eye, Copy as CopyIcon, ChevronDown, ChevronRight, FileDown } from "lucide-react";
import { getTemplate, saveNewVersion, renameTemplate, createTemplate, setDefaultForType } from "@/services/templateService";
import { blankInvoiceHtml, blankPickslipHtml, type TemplateConfig } from "@/lib/templates/document";
import { useToast } from "@/hooks/use-toast";
import { SEO } from "@/components/SEO";
import { useAuth } from "@/contexts/AuthProvider";

const MonacoEditor = dynamic(() => import("@monaco-editor/react").then((m) => m.default), {
  ssr: false,
  loading: () => <div className="h-full flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>,
});

const VARIABLE_GROUPS = [
  { label: "Order", items: [
    { token: "{{order.number}}", desc: "Order number" },
    { token: "{{order.date}}", desc: "Formatted order date" },
    { token: "{{order.date_iso}}", desc: "ISO timestamp (use with date helper)" },
    { token: "{{order.status}}", desc: "Status (processing, completed…)" },
    { token: "{{order.currency}}", desc: "ISO currency code" },
    { token: "{{order.currency_symbol}}", desc: "Currency symbol" },
    { token: "{{order.notes}}", desc: "Customer note" },
    { token: "{{order.transaction_id}}", desc: "Gateway transaction ID" },
    { token: "{{order.payment_method}}", desc: "Payment method slug" },
    { token: "{{order.payment_method_title}}", desc: "Payment method label" },
    { token: "{{order.total}}", desc: "Order total (raw)" },
    { token: "{{order.subtotal}}", desc: "Items subtotal (raw)" },
    { token: "{{order.tax_total}}", desc: "Total tax (raw)" },
    { token: "{{order.shipping_total}}", desc: "Shipping total (raw)" },
    { token: "{{order.discount_total}}", desc: "Discount total (raw)" },
  ]},
  { label: "Customer", items: [
    { token: "{{customer.id}}", desc: "Customer ID" },
    { token: "{{customer.name}}", desc: "Full name" },
    { token: "{{customer.first_name}}", desc: "First name" },
    { token: "{{customer.last_name}}", desc: "Last name" },
    { token: "{{customer.email}}", desc: "Email" },
    { token: "{{customer.phone}}", desc: "Phone" },
  ]},
  { label: "Billing", items: [
    { token: "{{billing.name}}", desc: "Full name" },
    { token: "{{billing.first_name}}", desc: "First name" },
    { token: "{{billing.last_name}}", desc: "Last name" },
    { token: "{{billing.email}}", desc: "Email" },
    { token: "{{billing.phone}}", desc: "Phone" },
    { token: "{{billing.company}}", desc: "Company" },
    { token: "{{billing.address.line1}}", desc: "Street line 1" },
    { token: "{{billing.address.line2}}", desc: "Street line 2" },
    { token: "{{billing.city}}", desc: "City" },
    { token: "{{billing.state}}", desc: "State / region" },
    { token: "{{billing.zip}}", desc: "Postal code" },
    { token: "{{billing.country}}", desc: "Country" },
    { token: "{{address billing}}", desc: "Render full block (helper)" },
  ]},
  { label: "Shipping", items: [
    { token: "{{shipping.name}}", desc: "Full name" },
    { token: "{{shipping.first_name}}", desc: "First name" },
    { token: "{{shipping.last_name}}", desc: "Last name" },
    { token: "{{shipping.company}}", desc: "Company" },
    { token: "{{shipping.address.line1}}", desc: "Street line 1" },
    { token: "{{shipping.address.line2}}", desc: "Street line 2" },
    { token: "{{shipping.city}}", desc: "City" },
    { token: "{{shipping.state}}", desc: "State / region" },
    { token: "{{shipping.zip}}", desc: "Postal code" },
    { token: "{{shipping.country}}", desc: "Country" },
    { token: "{{address shipping}}", desc: "Render full block (helper)" },
  ]},
  { label: "Payment", items: [
    { token: "{{payment.method}}", desc: "Method slug" },
    { token: "{{payment.title}}", desc: "Method label" },
    { token: "{{payment.status}}", desc: "Payment status" },
    { token: "{{payment.transaction_id}}", desc: "Gateway transaction ID" },
  ]},
  { label: "Shipping method", items: [
    { token: "{{shipping_method.name}}", desc: "Carrier / method name" },
    { token: "{{shipping_method.tracking_number}}", desc: "Tracking number" },
  ]},
  { label: "Totals", items: [
    { token: "{{totals.subtotal}}", desc: "Items subtotal" },
    { token: "{{totals.discount}}", desc: "Discount amount" },
    { token: "{{totals.shipping}}", desc: "Shipping cost" },
    { token: "{{totals.tax}}", desc: "Tax amount" },
    { token: "{{totals.total}}", desc: "Grand total" },
  ]},
  { label: "Items (loop)", items: [
    { token: "{{#each items}}", desc: "Open items loop" },
    { token: "{{name}}", desc: "Item name (inside loop)" },
    { token: "{{sku}}", desc: "SKU" },
    { token: "{{quantity}}", desc: "Quantity" },
    { token: "{{qty}}", desc: "Quantity (alias)" },
    { token: "{{price}}", desc: "Unit price" },
    { token: "{{subtotal}}", desc: "Line subtotal" },
    { token: "{{total}}", desc: "Line total" },
    { token: "{{image}}", desc: "Product image URL" },
    { token: "{{variation_text}}", desc: "All attributes joined ('Size: M, Color: Blue')" },
    { token: "{{variation.size}}", desc: "Specific attribute (lowercased key)" },
    { token: "{{variation.color}}", desc: "Specific attribute" },
    { token: "{{/each}}", desc: "Close items loop" },
  ]},
  { label: "Store", items: [
    { token: "{{store.name}}", desc: "Store name" },
    { token: "{{store.logo}}", desc: "Logo URL" },
    { token: "{{store.email}}", desc: "Support email" },
    { token: "{{store.phone}}", desc: "Phone" },
    { token: "{{store.website}}", desc: "Website URL" },
    { token: "{{store.url}}", desc: "Storefront URL" },
    { token: "{{store.currency}}", desc: "Default currency" },
    { token: "{{store.address.line1}}", desc: "Address line 1" },
    { token: "{{store.address.line2}}", desc: "Address line 2" },
    { token: "{{store.address.city}}", desc: "City" },
    { token: "{{store.address.state}}", desc: "State" },
    { token: "{{store.address.country}}", desc: "Country" },
    { token: "{{store.address.zip}}", desc: "Zip" },
  ]},
  { label: "Meta", items: [
    { token: "{{meta.note}}", desc: "Customer note" },
    { token: "{{meta.gift_message}}", desc: "Gift message (from order meta)" },
    { token: "{{meta.delivery_date}}", desc: "Delivery date (from order meta)" },
    { token: "{{meta.custom_field_1}}", desc: "Custom field 1" },
    { token: "{{meta.custom_field_2}}", desc: "Custom field 2" },
    { token: "{{meta.printed_at}}", desc: "Print timestamp" },
    { token: "{{meta.template_name}}", desc: "Template name" },
    { token: "{{meta.template_type}}", desc: "Template type" },
  ]},
  { label: "Helpers", items: [
    { token: "{{currency totals.total}}", desc: "Format money (uses order currency)" },
    { token: "{{currency totals.total order.currency}}", desc: "Format with explicit currency" },
    { token: "{{formatCurrency totals.total}}", desc: "Alias of currency" },
    { token: '{{date order.date_iso "short"}}', desc: "Format date (short/long/iso/datetime/time)" },
    { token: "{{formatDate order.date_iso}}", desc: "Alias of date" },
    { token: "{{barcode order.number}}", desc: "Render barcode SVG (use format=, width=, height=)" },
    { token: "{{qrcode order.number size=120}}", desc: "Render QR code image" },
    { token: '{{#ifCond order.status "completed"}}…{{else}}…{{/ifCond}}', desc: "Conditional equality block" },
    { token: "{{#if (gt totals.discount 0)}}…{{/if}}", desc: "Conditional with comparator (eq/neq/gt/lt/gte/lte)" },
    { token: "{{multiply price quantity}}", desc: "Math (multiply/add/subtract/divide)" },
    { token: "{{uppercase order.status}}", desc: "Uppercase / lowercase / capitalize / titlecase" },
    { token: '{{default customer.phone "—"}}', desc: "Fallback for empty value" },
    { token: "{{concat store.url '/orders/' order.number}}", desc: "Concatenate strings" },
  ]},
];

function BuilderInner() {
  const router = useRouter();
  const id = router.query.id as string;
  const isNew = id === "new";
  const newType = (router.query.type as string) === "pickslip" ? "pickslip" : "invoice";
  const qc = useQueryClient();
  const { toast } = useToast();
  const { profile } = useAuth();
  const creatingRef = useRef(false);

  useEffect(() => {
    if (!router.isReady || !isNew || creatingRef.current) return;
    if (!profile?.client_id) return;
    creatingRef.current = true;
    (async () => {
      try {
        const newId = await createTemplate({
          name: newType === "invoice" ? "Untitled invoice" : "Untitled pick slip",
          type: newType,
          clientId: profile.client_id as string,
          html: newType === "pickslip" ? blankPickslipHtml() : blankInvoiceHtml(),
        });
        router.replace(`/templates/${newId}`);
      } catch (e) {
        toast({ title: "Failed to create template", description: (e as Error).message, variant: "destructive" });
        router.replace("/templates");
      }
    })();
  }, [router.isReady, isNew, newType, profile?.client_id, router, toast]);

  const { data, isLoading } = useQuery({
    queryKey: ["template", id],
    queryFn: () => getTemplate(id),
    enabled: !!id && !isNew,
  });

  const [html, setHtml] = useState("");
  const [name, setName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [openGroup, setOpenGroup] = useState<string | null>("Order");
  const initialized = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (data && !initialized.current) {
      setName(data.template.name);
      const cfg = data.version?.document as TemplateConfig | undefined;
      setHtml(cfg?.html ?? "");
      initialized.current = true;
    }
  }, [data]);

  useEffect(() => {
    if (!dirty) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setPreviewKey((k) => k + 1), 600);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [html, dirty]);

  const saveMutation = useMutation({
    mutationFn: async () => saveNewVersion(id, html),
    onSuccess: () => {
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["template", id] });
      qc.invalidateQueries({ queryKey: ["templates"] });
      setPreviewKey((k) => k + 1);
      toast({ title: "Template saved" });
    },
    onError: (e: Error) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const renameMutation = useMutation({
    mutationFn: async (newName: string) => renameTemplate(id, newName),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["template", id] }),
  });

  const setDefaultMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.client_id || !data) return;
      await setDefaultForType(profile.client_id as string, data.template.type, id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["template", id] });
      qc.invalidateQueries({ queryKey: ["templates"] });
      toast({ title: "Set as default" });
    },
  });

  const previewSrc = useMemo(() => `/api/templates/${id}/render?format=html&sample=1&_=${previewKey}`, [id, previewKey]);

  const copyToken = (token: string) => {
    navigator.clipboard?.writeText(token).catch(() => {});
    toast({ title: "Copied", description: token });
  };

  if (isNew || isLoading || !data) {
    return <div className="h-screen flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  const isSample = data.template.is_sample;

  return (
    <>
      <SEO title={`${name || "Template"} · Editor`} />
      <div className="h-screen flex flex-col bg-background">
        <div className="h-14 border-b border-border bg-card px-4 flex items-center gap-3 shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.push("/templates")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Code2 className="h-4 w-4 text-muted-foreground" />
          <Badge variant="outline" className="capitalize text-[10px]">{data.template.type}</Badge>
          {editingName ? (
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => { setEditingName(false); if (name !== data.template.name) renameMutation.mutate(name); }}
              onKeyDown={(e) => {
                if (e.key === "Enter") { setEditingName(false); if (name !== data.template.name) renameMutation.mutate(name); }
                if (e.key === "Escape") { setName(data.template.name); setEditingName(false); }
              }}
              className="h-7 max-w-xs text-sm"
            />
          ) : (
            <button className="flex items-center gap-1.5 group" onClick={() => !isSample && setEditingName(true)} disabled={isSample}>
              <span className="text-sm font-semibold">{name}</span>
              {!isSample && <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />}
            </button>
          )}
          {dirty && <span className="text-[10px] text-amber-600">• unsaved</span>}
          {isSample && <Badge variant="outline" className="h-5 text-[10px] border-amber-300 text-amber-800 bg-amber-50">Read-only sample</Badge>}
          <div className="ml-auto flex items-center gap-2">
            {!isSample && (
              <Button size="sm" variant="outline" onClick={() => setDefaultMutation.mutate()} disabled={data.template.is_default_for_type || setDefaultMutation.isPending}>
                <Star className={`h-3.5 w-3.5 mr-1.5 ${data.template.is_default_for_type ? "fill-amber-500 text-amber-500" : ""}`} />
                {data.template.is_default_for_type ? "Default" : "Set default"}
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setPreviewKey((k) => k + 1)}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Refresh preview
            </Button>
            <Button size="sm" variant="outline" onClick={() => window.open(`/api/templates/${id}/render?format=pdf&sample=1`, "_blank")} disabled={dirty}>
              <FileDown className="h-3.5 w-3.5 mr-1.5" />
              Download PDF
            </Button>
            <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !dirty || isSample}>
              {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
              Save
            </Button>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-[1fr_1fr_280px] overflow-hidden">
          <div className="border-r border-border min-h-0 overflow-hidden flex flex-col">
            <div className="px-3 py-1.5 border-b border-border bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
              <Code2 className="h-3 w-3" /> HTML
            </div>
            <div className="flex-1 min-h-0">
              <MonacoEditor
                height="100%"
                language="html"
                theme="vs-light"
                value={html}
                onChange={(v) => { setHtml(v ?? ""); setDirty(true); }}
                options={{
                  minimap: { enabled: false },
                  fontSize: 12,
                  wordWrap: "on",
                  scrollBeyondLastLine: false,
                  readOnly: isSample,
                  tabSize: 2,
                  formatOnPaste: true,
                  automaticLayout: true,
                }}
              />
            </div>
          </div>

          <div className="border-r border-border min-h-0 overflow-hidden flex flex-col">
            <div className="px-3 py-1.5 border-b border-border bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
              <Eye className="h-3 w-3" /> Live preview (sample data)
            </div>
            <iframe
              key={previewKey}
              src={previewSrc}
              sandbox="allow-same-origin"
              className="flex-1 w-full border-0 bg-white"
              title="Template preview"
            />
          </div>

          <div className="hidden md:flex flex-col min-h-0 overflow-hidden">
            <div className="px-3 py-1.5 border-b border-border bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Variables & helpers
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {VARIABLE_GROUPS.map((g) => (
                  <div key={g.label} className="rounded border border-border bg-card overflow-hidden">
                    <button
                      onClick={() => setOpenGroup(openGroup === g.label ? null : g.label)}
                      className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-semibold hover:bg-muted/50"
                    >
                      <span>{g.label}</span>
                      {openGroup === g.label ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    </button>
                    {openGroup === g.label && (
                      <div className="border-t border-border">
                        {g.items.map((item) => (
                          <button
                            key={item.token}
                            onClick={() => copyToken(item.token)}
                            className="w-full text-left px-2 py-1.5 hover:bg-muted/40 border-b border-border/50 last:border-b-0 group"
                          >
                            <div className="flex items-center gap-1">
                              <code className="text-[10px] font-mono text-primary truncate flex-1">{item.token}</code>
                              <CopyIcon className="h-2.5 w-2.5 text-muted-foreground opacity-0 group-hover:opacity-100" />
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">{item.desc}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>
    </>
  );
}

export default function TemplateEditorPage() {
  return <AuthGuard><BuilderInner /></AuthGuard>;
}