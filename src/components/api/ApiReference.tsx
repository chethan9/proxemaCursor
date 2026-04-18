import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Copy, Zap, Globe, Lock, Clock, Terminal } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface EPParam {
  name: string;
  type: string;
  required: boolean;
  desc: string;
  example?: string;
}

interface EPDef {
  method: string;
  path: string;
  summary: string;
  desc: string;
  scope: string;
  params: EPParam[];
  response: string;
}

const ENDPOINTS: EPDef[] = [
  {
    method: "GET", path: "/api/v1/stores", summary: "List stores",
    desc: "Returns all WooCommerce stores belonging to the authenticated client.",
    scope: "read", params: [],
    response: JSON.stringify({ data: [{ id: "uuid-1", name: "My Store", url: "https://store.example.com", status: "connected", last_sync_at: "2026-04-17T12:00:00Z" }], total: 1 }, null, 2),
  },
  {
    method: "GET", path: "/api/v1/products", summary: "List products",
    desc: "Paginated products for a store. Supports search and status filtering.",
    scope: "read",
    params: [
      { name: "store_id", type: "uuid", required: true, desc: "Store UUID", example: "6aa04e65-..." },
      { name: "page", type: "integer", required: false, desc: "Page number (default: 1)", example: "1" },
      { name: "per_page", type: "integer", required: false, desc: "Items per page, max 100", example: "20" },
      { name: "search", type: "string", required: false, desc: "Search product name", example: "T-Shirt" },
      { name: "status", type: "string", required: false, desc: "publish, draft, pending", example: "publish" },
    ],
    response: JSON.stringify({ data: [{ id: "uuid", woo_id: 123, name: "Premium T-Shirt", sku: "TSH-001", price: "29.99", status: "publish", stock_quantity: 45 }], total: 156, page: 1, per_page: 20 }, null, 2),
  },
  {
    method: "GET", path: "/api/v1/orders", summary: "List orders",
    desc: "Paginated orders with status filtering and search.",
    scope: "read",
    params: [
      { name: "store_id", type: "uuid", required: true, desc: "Store UUID", example: "6aa04e65-..." },
      { name: "page", type: "integer", required: false, desc: "Page number", example: "1" },
      { name: "per_page", type: "integer", required: false, desc: "Items per page, max 100", example: "20" },
      { name: "status", type: "string", required: false, desc: "Order status filter", example: "processing" },
      { name: "search", type: "string", required: false, desc: "Order number or email", example: "1042" },
    ],
    response: JSON.stringify({ data: [{ id: "uuid", woo_id: 1042, status: "processing", total: "89.97", currency: "USD", line_items_count: 3, date_created: "2026-04-17T10:30:00Z" }], total: 2110, page: 1, per_page: 20 }, null, 2),
  },
  {
    method: "GET", path: "/api/v1/customers", summary: "List customers",
    desc: "Paginated customers with search by name or email.",
    scope: "read",
    params: [
      { name: "store_id", type: "uuid", required: true, desc: "Store UUID", example: "6aa04e65-..." },
      { name: "page", type: "integer", required: false, desc: "Page number", example: "1" },
      { name: "per_page", type: "integer", required: false, desc: "Items per page, max 100", example: "20" },
      { name: "search", type: "string", required: false, desc: "Name or email", example: "john@example.com" },
    ],
    response: JSON.stringify({ data: [{ id: "uuid", woo_id: 5, email: "john@example.com", first_name: "John", last_name: "Doe", orders_count: 12, total_spent: "1249.50" }], total: 2981, page: 1, per_page: 20 }, null, 2),
  },
  {
    method: "GET", path: "/api/v1/categories", summary: "List categories",
    desc: "All product categories for a store with parent references.",
    scope: "read",
    params: [{ name: "store_id", type: "uuid", required: true, desc: "Store UUID", example: "6aa04e65-..." }],
    response: JSON.stringify({ data: [{ id: "uuid", woo_id: 15, name: "Apparel", slug: "apparel", parent_id: null, count: 24 }], total: 12 }, null, 2),
  },
];

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-emerald-100 text-emerald-700 border-emerald-200",
  POST: "bg-blue-100 text-blue-700 border-blue-200",
  PATCH: "bg-amber-100 text-amber-700 border-amber-200",
  DELETE: "bg-rose-100 text-rose-700 border-rose-200",
};

const ERROR_CODES = [
  { status: "400", code: "BAD_REQUEST", desc: "Missing or invalid query parameters" },
  { status: "401", code: "UNAUTHORIZED", desc: "Missing or invalid API key" },
  { status: "403", code: "FORBIDDEN", desc: "Insufficient scope or origin not allowed" },
  { status: "404", code: "NOT_FOUND", desc: "Resource or endpoint not found" },
  { status: "429", code: "RATE_LIMITED", desc: "Rate limit exceeded \u2014 retry after X-RateLimit-Reset" },
  { status: "500", code: "INTERNAL_ERROR", desc: "Server error \u2014 contact support if persistent" },
];

function CopyButton({ text, label }: { text: string; label?: string }) {
  const { toast } = useToast();
  return (
    <Button
      variant="ghost" size="sm"
      className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
      onClick={() => { navigator.clipboard.writeText(text); toast({ title: "Copied" }); }}
    >
      <Copy className="h-3 w-3" />
      {label || "Copy"}
    </Button>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-950 p-4 font-mono text-[13px] leading-relaxed text-slate-300">
      {children}
    </pre>
  );
}

function buildCurl(base: string, ep: EPDef) {
  let url = base + ep.path;
  const qs = ep.params.filter((p) => p.example).map((p) => p.name + "=" + p.example).join("&");
  if (qs) url += "?" + qs;
  return "curl -X " + ep.method + " \\\n  -H \"Authorization: Bearer wsk_YOUR_API_KEY\" \\\n  -H \"Content-Type: application/json\" \\\n  \"" + url + "\"";
}

interface ApiReferenceProps {
  baseUrl: string;
}

export function ApiReference({ baseUrl }: ApiReferenceProps) {
  const fullBase = (baseUrl || "https://your-domain.com") + "/api/v1";

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="h-4 w-4 text-primary" />
            Getting Started
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { n: "1", t: "Create an API Key", d: "Go to the API Keys tab and generate a key scoped to your client." },
              { n: "2", t: "Add Auth Header", d: "Include your key as a Bearer token in every request." },
              { n: "3", t: "Query Data", d: "Fetch stores, products, orders, and customers via the endpoints below." },
            ].map((s) => (
              <div key={s.n} className="rounded-lg border bg-muted/30 p-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                    {s.n}
                  </div>
                  <span className="text-sm font-semibold">{s.t}</span>
                </div>
                <p className="mt-2 pl-[34px] text-xs text-muted-foreground leading-relaxed">{s.d}</p>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="flex items-center gap-2 text-sm font-semibold">
                <Globe className="h-3.5 w-3.5 text-muted-foreground" /> Base URL
              </h4>
              <CopyButton text={fullBase} />
            </div>
            <CodeBlock>{fullBase}</CodeBlock>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="flex items-center gap-2 text-sm font-semibold">
                <Lock className="h-3.5 w-3.5 text-muted-foreground" /> Authentication
              </h4>
              <CopyButton text="Authorization: Bearer wsk_YOUR_API_KEY" />
            </div>
            <CodeBlock>{"# Include in every request header:\nAuthorization: Bearer wsk_YOUR_API_KEY"}</CodeBlock>
          </div>

          <div className="space-y-2">
            <h4 className="flex items-center gap-2 text-sm font-semibold">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" /> Rate Limiting
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Configured per API key (default: 1,000 req/hour). Check these response headers:
            </p>
            <CodeBlock>{"X-RateLimit-Limit: 1000\nX-RateLimit-Remaining: 987\nX-RateLimit-Reset: 1713400000"}</CodeBlock>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Terminal className="h-4 w-4 text-primary" /> Endpoints
          </CardTitle>
          <CardDescription>Complete REST API v1 reference</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Accordion type="multiple" className="w-full">
            {ENDPOINTS.map((ep, i) => {
              const curl = buildCurl(baseUrl || "https://your-domain.com", ep);
              return (
                <AccordionItem key={i} value={"ep-" + i} className="border-b last:border-b-0">
                  <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/40">
                    <div className="flex items-center gap-3 text-left w-full">
                      <span className={"shrink-0 inline-flex items-center justify-center rounded border px-2 py-0.5 text-[11px] font-bold " + METHOD_COLORS[ep.method]}>
                        {ep.method}
                      </span>
                      <code className="font-mono text-sm font-medium">{ep.path}</code>
                      <span className="hidden text-xs text-muted-foreground sm:inline">{ep.summary}</span>
                      <Badge variant="outline" className="ml-auto mr-3 shrink-0 font-mono text-[10px]">{ep.scope}</Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-5">
                    <div className="space-y-4 pt-1">
                      <p className="text-sm text-muted-foreground">{ep.desc}</p>

                      {ep.params.length > 0 && (
                        <div className="space-y-2">
                          <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Parameters</h5>
                          <div className="overflow-hidden rounded-lg border">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-muted/40 hover:bg-muted/40">
                                  <TableHead className="h-8 pl-3 text-xs w-[130px]">Name</TableHead>
                                  <TableHead className="h-8 text-xs w-[80px]">Type</TableHead>
                                  <TableHead className="h-8 text-xs w-[80px]">Required</TableHead>
                                  <TableHead className="h-8 text-xs">Description</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {ep.params.map((p) => (
                                  <TableRow key={p.name}>
                                    <TableCell className="pl-3"><code className="text-xs font-semibold text-primary">{p.name}</code></TableCell>
                                    <TableCell><code className="text-[11px] text-muted-foreground">{p.type}</code></TableCell>
                                    <TableCell>
                                      {p.required
                                        ? <Badge className="bg-rose-50 text-rose-600 border-rose-200 text-[10px] hover:bg-rose-50">required</Badge>
                                        : <span className="text-[11px] text-muted-foreground">optional</span>}
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">{p.desc}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      )}

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">cURL Example</h5>
                          <CopyButton text={curl} label="Copy cURL" />
                        </div>
                        <CodeBlock>{curl}</CodeBlock>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Response</h5>
                          <CopyButton text={ep.response} />
                        </div>
                        <pre className="overflow-x-auto rounded-lg border bg-muted/30 p-4 font-mono text-[13px] leading-relaxed text-foreground/80">{ep.response}</pre>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Error Codes</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="h-8 w-[80px] pl-4 text-xs">Status</TableHead>
                <TableHead className="h-8 w-[160px] text-xs">Code</TableHead>
                <TableHead className="h-8 text-xs">Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ERROR_CODES.map((e) => (
                <TableRow key={e.status}>
                  <TableCell className="pl-4">
                    <StatusBadge variant={parseInt(e.status) < 400 ? "success" : parseInt(e.status) < 500 ? "warning" : "error"}>
                      {e.status}
                    </StatusBadge>
                  </TableCell>
                  <TableCell><code className="font-mono text-xs font-bold">{e.code}</code></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{e.desc}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}