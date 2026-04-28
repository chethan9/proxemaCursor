import { useEffect, useState, useCallback, useMemo } from "react";
import { SettingsLayout } from "@/components/layout/SettingsLayout";
import { AuthGuard } from "@/components/AuthGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { getMenuConfig, saveMenuConfig, resetMenuConfig, type MenuNode } from "@/services/menuConfigService";
import { listRoles, type RoleRow } from "@/services/userService";
import { mergeMenu } from "@/lib/menu-merge";
import { MENU_REGISTRY } from "@/lib/menu-registry";
import { IconPicker } from "@/components/menu-editor/IconPicker";
import { Eye, EyeOff, Trash2, FolderPlus, RotateCcw, Loader2, ArrowUp, ArrowDown, PanelRight } from "lucide-react";
import { cn } from "@/lib/utils";

const NONE_GROUP = "__none__";

function humanizeRole(name: string): string {
  return name.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

type FlatRow = {
  itemId: string;
  label: string;
  icon: string;
  hidden: boolean;
  groupId: string; // "__none__" = top-level
};

type OrderEntry = { kind: "group" | "item"; id: string };

function flattenTree(tree: MenuNode[]): { rows: FlatRow[]; groups: MenuNode[]; order: OrderEntry[] } {
  const rows: FlatRow[] = [];
  const groups: MenuNode[] = [];
  const order: OrderEntry[] = [];
  for (const n of tree) {
    if (n.type === "group") {
      groups.push(n);
      order.push({ kind: "group", id: n.id });
      for (const child of n.children || []) {
        if (child.type === "item") {
          rows.push({ itemId: child.id, label: child.label, icon: child.icon, hidden: !!child.hidden, groupId: n.id });
        }
      }
    } else if (n.type === "item") {
      order.push({ kind: "item", id: n.id });
      rows.push({ itemId: n.id, label: n.label, icon: n.icon, hidden: !!n.hidden, groupId: NONE_GROUP });
    }
  }
  return { rows, groups, order };
}

function rebuildTree(rows: FlatRow[], groups: MenuNode[], order: OrderEntry[]): MenuNode[] {
  const rowByItem = new Map<string, FlatRow>();
  for (const r of rows) rowByItem.set(r.itemId, r);
  const groupById = new Map<string, MenuNode>();
  for (const g of groups) groupById.set(g.id, g);
  const rowsByGroup = new Map<string, FlatRow[]>();
  for (const r of rows) {
    if (r.groupId === NONE_GROUP) continue;
    if (!rowsByGroup.has(r.groupId)) rowsByGroup.set(r.groupId, []);
    rowsByGroup.get(r.groupId)!.push(r);
  }
  const result: MenuNode[] = [];
  const seenItems = new Set<string>();
  for (const entry of order) {
    if (entry.kind === "item") {
      const r = rowByItem.get(entry.id);
      if (r && r.groupId === NONE_GROUP) {
        result.push({ id: r.itemId, type: "item", label: r.label, icon: r.icon, hidden: r.hidden });
        seenItems.add(r.itemId);
      }
    } else {
      const g = groupById.get(entry.id);
      if (!g) continue;
      const children = (rowsByGroup.get(g.id) || []).map((r) => ({
        id: r.itemId, type: "item" as const, label: r.label, icon: r.icon, hidden: r.hidden,
      }));
      if (children.length > 0 || g.id.startsWith("group-custom-")) result.push({ ...g, children });
    }
  }
  // Append any ungrouped items not in order (newly detached)
  for (const r of rows) {
    if (r.groupId === NONE_GROUP && !seenItems.has(r.itemId)) {
      result.push({ id: r.itemId, type: "item", label: r.label, icon: r.icon, hidden: r.hidden });
    }
  }
  return result;
}

function MenuEditorInner() {
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [role, setRole] = useState<string>("");
  const [rows, setRows] = useState<FlatRow[]>([]);
  const [groups, setGroups] = useState<MenuNode[]>([]);
  const [order, setOrder] = useState<OrderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    listRoles().then((rs) => {
      setRoles(rs);
      if (rs.length > 0 && !role) setRole(rs[0].name);
    }).catch((e) => toast({ title: "Failed to load roles", description: (e as Error).message, variant: "destructive" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async (r: string) => {
    if (!r) return;
    setLoading(true);
    try {
      const cfg = await getMenuConfig(r);
      const { tree } = mergeMenu(cfg);
      const { rows: flatRows, groups: flatGroups, order: flatOrder } = flattenTree(tree);
      setRows(flatRows);
      setGroups(flatGroups);
      setOrder(flatOrder);
      setDirty(false);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (role) load(role); }, [role, load]);

  const updateRow = (itemId: string, patch: Partial<FlatRow>) => {
    setRows((rs) => {
      const row = rs.find((r) => r.itemId === itemId);
      if (!row) return rs;
      const nextGroupId = patch.groupId ?? row.groupId;
      // Track group transitions to adjust order
      if (patch.groupId !== undefined && patch.groupId !== row.groupId) {
        setOrder((o) => {
          const has = o.some((e) => e.kind === "item" && e.id === itemId);
          if (nextGroupId === NONE_GROUP && !has) {
            return [...o, { kind: "item", id: itemId }];
          }
          if (nextGroupId !== NONE_GROUP && has) {
            return o.filter((e) => !(e.kind === "item" && e.id === itemId));
          }
          return o;
        });
      }
      return rs.map((r) => r.itemId === itemId ? { ...r, ...patch } : r);
    });
    setDirty(true);
  };

  const moveRow = (itemId: string, dir: -1 | 1) => {
    const row = rows.find((r) => r.itemId === itemId);
    if (!row) return;
    if (row.groupId === NONE_GROUP) {
      // Move at top-level: reorder entry in order array
      setOrder((o) => {
        const idx = o.findIndex((e) => e.kind === "item" && e.id === itemId);
        if (idx < 0) return o;
        const target = idx + dir;
        if (target < 0 || target >= o.length) return o;
        const copy = [...o];
        const [moved] = copy.splice(idx, 1);
        copy.splice(target, 0, moved);
        return copy;
      });
      setDirty(true);
      return;
    }
    setRows((rs) => {
      const sameGroup = rs.filter((r) => r.groupId === row.groupId);
      const idxInGroup = sameGroup.findIndex((r) => r.itemId === itemId);
      const targetIdx = idxInGroup + dir;
      if (targetIdx < 0 || targetIdx >= sameGroup.length) return rs;
      const groupRowsReordered = [...sameGroup];
      const [moved] = groupRowsReordered.splice(idxInGroup, 1);
      groupRowsReordered.splice(targetIdx, 0, moved);
      const newOrder: FlatRow[] = [];
      let gc = 0;
      for (const r of rs) newOrder.push(r.groupId === row.groupId ? groupRowsReordered[gc++] : r);
      return newOrder;
    });
    setDirty(true);
  };

  const moveEntry = (idx: number, dir: -1 | 1) => {
    setOrder((o) => {
      const target = idx + dir;
      if (target < 0 || target >= o.length) return o;
      const copy = [...o];
      const [moved] = copy.splice(idx, 1);
      copy.splice(target, 0, moved);
      return copy;
    });
    setDirty(true);
  };

  const addGroup = () => {
    const id = `group-custom-${Date.now()}`;
    setGroups((g) => [...g, { id, type: "group", label: "New Group", icon: "Folder", children: [] }]);
    setOrder((o) => [...o, { kind: "group", id }]);
    setDirty(true);
  };

  const deleteGroup = (gid: string) => {
    if (!gid.startsWith("group-custom-")) return;
    setRows((rs) => rs.map((r) => {
      if (r.groupId !== gid) return r;
      setOrder((o) => {
        const has = o.some((e) => e.kind === "item" && e.id === r.itemId);
        return has ? o : [...o, { kind: "item", id: r.itemId }];
      });
      return { ...r, groupId: NONE_GROUP };
    }));
    setGroups((g) => g.filter((x) => x.id !== gid));
    setOrder((o) => o.filter((e) => !(e.kind === "group" && e.id === gid)));
    setDirty(true);
  };

  const renameGroup = (gid: string, label: string) => {
    setGroups((g) => g.map((x) => x.id === gid ? { ...x, label } : x));
    setDirty(true);
  };

  const resetRow = (itemId: string) => {
    const reg = MENU_REGISTRY.find((r) => r.id === itemId);
    if (!reg) return;
    updateRow(itemId, { label: reg.defaultLabel, icon: reg.defaultIcon, hidden: false });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const tree = rebuildTree(rows, groups, order);
      await saveMenuConfig(role, tree);
      setDirty(false);
      if (typeof window !== "undefined") {
        try {
          localStorage.removeItem(`sidebar-menu-cache:${role}`);
          window.dispatchEvent(new CustomEvent("menu-config-updated", { detail: { role } }));
        } catch { /* ignore */ }
      }
      toast({ title: "Saved", description: `Menu for ${humanizeRole(role)} updated.` });
    } catch (err) {
      toast({ title: "Save failed", description: (err as Error).message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleReset = async () => {
    if (!confirm(`Reset menu for ${humanizeRole(role)} to defaults?`)) return;
    await resetMenuConfig(role);
    await load(role);
    toast({ title: "Reset", description: "Menu restored to defaults." });
  };

  const toggleGroupMode = (gid: string) => {
    setGroups((gs) => gs.map((g) => g.id === gid ? { ...g, displayMode: g.displayMode === "panel" ? "inline" : "panel" } : g));
    setDirty(true);
  };

  const groupOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [{ value: NONE_GROUP, label: "(no group)" }];
    for (const g of groups) opts.push({ value: g.id, label: g.label });
    return opts;
  }, [groups]);

  const rowByItem = useMemo(() => {
    const map = new Map<string, FlatRow>();
    for (const r of rows) map.set(r.itemId, r);
    return map;
  }, [rows]);

  const rowsByGroup = useMemo(() => {
    const map = new Map<string, FlatRow[]>();
    for (const r of rows) {
      if (r.groupId === NONE_GROUP) continue;
      if (!map.has(r.groupId)) map.set(r.groupId, []);
      map.get(r.groupId)!.push(r);
    }
    return map;
  }, [rows]);

  if (roles.length === 0 && !loading) {
    return <div className="p-6 text-sm text-muted-foreground">No roles found.</div>;
  }

  const renderRowControls = (r: FlatRow, idx: number, total: number) => (
    <div className={cn("flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/50", r.hidden && "opacity-50")}>
      <div className="flex flex-col">
        <button onClick={() => moveRow(r.itemId, -1)} disabled={idx === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30 h-3">
          <ArrowUp className="h-3 w-3" />
        </button>
        <button onClick={() => moveRow(r.itemId, 1)} disabled={idx === total - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30 h-3">
          <ArrowDown className="h-3 w-3" />
        </button>
      </div>
      <IconPicker value={r.icon} onChange={(icon) => updateRow(r.itemId, { icon })} />
      <Input
        value={r.label}
        onChange={(e) => updateRow(r.itemId, { label: e.target.value })}
        className="h-7 text-sm flex-1"
      />
      <Select value={r.groupId} onValueChange={(v) => updateRow(r.itemId, { groupId: v })}>
        <SelectTrigger className="h-7 w-[130px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {groupOptions.map((o) => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
      <Button size="icon" variant="ghost" onClick={() => updateRow(r.itemId, { hidden: !r.hidden })} title={r.hidden ? "Show" : "Hide"} className="h-7 w-7">
        {r.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </Button>
      <Button size="icon" variant="ghost" onClick={() => resetRow(r.itemId)} title="Reset to default" className="h-7 w-7">
        <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
      </Button>
    </div>
  );

  // Count top-level items in order for index tracking
  const topLevelIndices = new Map<string, number>();
  {
    let i = 0;
    for (const e of order) if (e.kind === "item") { topLevelIndices.set(e.id, i++); }
  }
  const topLevelCount = topLevelIndices.size;

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-4">
        <h1 className="text-xl font-semibold">Menu Editor</h1>
        <p className="text-xs text-muted-foreground">Rename, reorder, hide, and group sidebar items per role. Ungrouped items can sit anywhere between groups.</p>
      </div>

      {roles.length > 0 && (
        <Tabs value={role} onValueChange={setRole} className="mb-3">
          <TabsList className="h-9">
            {roles.map((r) => <TabsTrigger key={r.id} value={r.name} className="text-xs">{humanizeRole(r.name)}</TabsTrigger>)}
          </TabsList>
        </Tabs>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="divide-y divide-border">
              {order.map((entry, entryIdx) => {
                if (entry.kind === "item") {
                  const r = rowByItem.get(entry.id);
                  if (!r || r.groupId !== NONE_GROUP) return null;
                  return (
                    <div key={`item-${entry.id}`} className="p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="flex flex-col">
                          <button onClick={() => moveEntry(entryIdx, -1)} disabled={entryIdx === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30 h-3">
                            <ArrowUp className="h-3 w-3" />
                          </button>
                          <button onClick={() => moveEntry(entryIdx, 1)} disabled={entryIdx === order.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30 h-3">
                            <ArrowDown className="h-3 w-3" />
                          </button>
                        </div>
                        <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/60">Top level</span>
                      </div>
                      <div className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/50">
                        <IconPicker value={r.icon} onChange={(icon) => updateRow(r.itemId, { icon })} />
                        <Input value={r.label} onChange={(e) => updateRow(r.itemId, { label: e.target.value })} className="h-7 text-sm flex-1" />
                        <Select value={r.groupId} onValueChange={(v) => updateRow(r.itemId, { groupId: v })}>
                          <SelectTrigger className="h-7 w-[130px] text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {groupOptions.map((o) => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Button size="icon" variant="ghost" onClick={() => updateRow(r.itemId, { hidden: !r.hidden })} title={r.hidden ? "Show" : "Hide"} className="h-7 w-7">
                          {r.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => resetRow(r.itemId)} title="Reset to default" className="h-7 w-7">
                          <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                  );
                }
                const g = groups.find((x) => x.id === entry.id);
                if (!g) return null;
                const sectionRows = rowsByGroup.get(g.id) || [];
                const isPanel = g.displayMode === "panel";
                return (
                  <div key={`group-${g.id}`} className="p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex flex-col">
                        <button onClick={() => moveEntry(entryIdx, -1)} disabled={entryIdx === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30 h-3">
                          <ArrowUp className="h-3 w-3" />
                        </button>
                        <button onClick={() => moveEntry(entryIdx, 1)} disabled={entryIdx === order.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30 h-3">
                          <ArrowDown className="h-3 w-3" />
                        </button>
                      </div>
                      <IconPicker value={g.icon || "Folder"} onChange={(icon) => { setGroups((gs) => gs.map((x) => x.id === g.id ? { ...x, icon } : x)); setDirty(true); }} />
                      <Input value={g.label} onChange={(e) => renameGroup(g.id, e.target.value)} className="h-7 text-[11px] uppercase tracking-wider font-semibold max-w-[220px]" />
                      <span className="text-[10px] text-muted-foreground">({sectionRows.length})</span>
                      <div className="flex-1" />
                      <Button size="sm" variant={isPanel ? "default" : "outline"} onClick={() => toggleGroupMode(g.id)} title="Inline expands below. Panel opens as second sidebar column." className="h-6 px-2 text-[10px] gap-1">
                        <PanelRight className="h-3 w-3" />
                        {isPanel ? "Panel" : "Inline"}
                      </Button>
                      {g.id.startsWith("group-custom-") && (
                        <Button size="icon" variant="ghost" onClick={() => deleteGroup(g.id)} title="Delete group" className="h-6 w-6">
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      )}
                    </div>
                    <div className="space-y-1">
                      {sectionRows.map((r, idx) => (
                        <div key={r.itemId}>
                          {renderRowControls(r, idx, sectionRows.length)}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-3 flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={addGroup}><FolderPlus className="h-3.5 w-3.5 mr-1.5" />Add Group</Button>
        <Button size="sm" variant="outline" onClick={handleReset}>Reset All</Button>
        <div className="flex-1" />
        {dirty && <span className="text-xs text-muted-foreground">Unsaved changes</span>}
        <Button size="sm" onClick={handleSave} disabled={saving || !dirty}>{saving ? "Saving..." : "Save"}</Button>
        {topLevelCount > 0 && <span className="text-[10px] text-muted-foreground ml-2">{topLevelCount} top-level</span>}
      </div>
    </div>
  );
}

export default function MenuEditorPage() {
  return (
    <AuthGuard requireSuperAdmin>
      <SettingsLayout title="Menu Editor">
        <MenuEditorInner />
      </SettingsLayout>
    </AuthGuard>
  );
}