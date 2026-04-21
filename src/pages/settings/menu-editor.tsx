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
import { Eye, EyeOff, Trash2, FolderPlus, RotateCcw, Loader2, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

function humanizeRole(name: string): string {
  return name.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

type FlatRow = {
  itemId: string;
  label: string;
  icon: string;
  hidden: boolean;
  groupId: string;
};

function flattenTree(tree: MenuNode[]): { rows: FlatRow[]; groups: MenuNode[] } {
  const rows: FlatRow[] = [];
  const groups: MenuNode[] = [];
  for (const n of tree) {
    if (n.type === "group") {
      groups.push(n);
      for (const child of n.children || []) {
        if (child.type === "item") {
          rows.push({
            itemId: child.id,
            label: child.label,
            icon: child.icon,
            hidden: !!child.hidden,
            groupId: n.id,
          });
        }
      }
    } else if (n.type === "item") {
      // Top-level items: wrap in a synthetic "root" group
      rows.push({ itemId: n.id, label: n.label, icon: n.icon, hidden: !!n.hidden, groupId: "__root__" });
    }
  }
  return { rows, groups };
}

function rebuildTree(rows: FlatRow[], groups: MenuNode[]): MenuNode[] {
  const byGroup = new Map<string, FlatRow[]>();
  for (const r of rows) {
    if (!byGroup.has(r.groupId)) byGroup.set(r.groupId, []);
    byGroup.get(r.groupId)!.push(r);
  }
  const result: MenuNode[] = [];
  // Top-level items first
  const rootRows = byGroup.get("__root__") || [];
  for (const r of rootRows) {
    result.push({ id: r.itemId, type: "item", label: r.label, icon: r.icon, hidden: r.hidden });
  }
  // Then groups with their items
  for (const g of groups) {
    const children = (byGroup.get(g.id) || []).map((r) => ({
      id: r.itemId, type: "item" as const, label: r.label, icon: r.icon, hidden: r.hidden,
    }));
    if (children.length > 0 || g.id.startsWith("group-custom-")) {
      result.push({ ...g, children });
    }
  }
  return result;
}

function MenuEditorInner() {
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [role, setRole] = useState<string>("");
  const [rows, setRows] = useState<FlatRow[]>([]);
  const [groups, setGroups] = useState<MenuNode[]>([]);
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
      const { rows: flatRows, groups: flatGroups } = flattenTree(tree);
      setRows(flatRows);
      setGroups(flatGroups);
      setDirty(false);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (role) load(role); }, [role, load]);

  const updateRow = (itemId: string, patch: Partial<FlatRow>) => {
    setRows((rs) => rs.map((r) => r.itemId === itemId ? { ...r, ...patch } : r));
    setDirty(true);
  };

  const moveRow = (itemId: string, dir: -1 | 1) => {
    setRows((rs) => {
      const row = rs.find((r) => r.itemId === itemId);
      if (!row) return rs;
      const sameGroup = rs.filter((r) => r.groupId === row.groupId);
      const idxInGroup = sameGroup.findIndex((r) => r.itemId === itemId);
      const targetIdx = idxInGroup + dir;
      if (targetIdx < 0 || targetIdx >= sameGroup.length) return rs;
      const newOrder: FlatRow[] = [];
      const groupRowsReordered = [...sameGroup];
      const [moved] = groupRowsReordered.splice(idxInGroup, 1);
      groupRowsReordered.splice(targetIdx, 0, moved);
      let groupCursor = 0;
      for (const r of rs) {
        if (r.groupId === row.groupId) {
          newOrder.push(groupRowsReordered[groupCursor++]);
        } else {
          newOrder.push(r);
        }
      }
      return newOrder;
    });
    setDirty(true);
  };

  const moveGroup = (gid: string, dir: -1 | 1) => {
    setGroups((gs) => {
      const idx = gs.findIndex((g) => g.id === gid);
      if (idx < 0) return gs;
      const target = idx + dir;
      if (target < 0 || target >= gs.length) return gs;
      const copy = [...gs];
      const [moved] = copy.splice(idx, 1);
      copy.splice(target, 0, moved);
      return copy;
    });
    setDirty(true);
  };

  const addGroup = () => {
    const id = `group-custom-${Date.now()}`;
    setGroups((g) => [...g, { id, type: "group", label: "New Group", icon: "Folder", children: [] }]);
    setDirty(true);
  };

  const deleteGroup = (gid: string) => {
    if (!gid.startsWith("group-custom-")) return;
    // Move items in this group to first default group
    const firstDefault = groups.find((g) => !g.id.startsWith("group-custom-"))?.id || "__root__";
    setRows((rs) => rs.map((r) => r.groupId === gid ? { ...r, groupId: firstDefault } : r));
    setGroups((g) => g.filter((x) => x.id !== gid));
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
      const tree = rebuildTree(rows, groups);
      await saveMenuConfig(role, tree);
      setDirty(false);
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

  const groupOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [{ value: "__root__", label: "(no group)" }];
    for (const g of groups) opts.push({ value: g.id, label: g.label });
    return opts;
  }, [groups]);

  const rowsByGroup = useMemo(() => {
    const map = new Map<string, FlatRow[]>();
    for (const r of rows) {
      if (!map.has(r.groupId)) map.set(r.groupId, []);
      map.get(r.groupId)!.push(r);
    }
    return map;
  }, [rows]);

  const orderedGroups = useMemo(() => {
    const list: { id: string; label: string; editable: boolean }[] = [
      { id: "__root__", label: "Top level", editable: false },
    ];
    for (const g of groups) list.push({ id: g.id, label: g.label, editable: g.id.startsWith("group-custom-") });
    return list;
  }, [groups]);

  if (roles.length === 0 && !loading) {
    return <div className="p-6 text-sm text-muted-foreground">No roles found.</div>;
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-4">
        <h1 className="text-xl font-semibold">Menu Editor</h1>
        <p className="text-xs text-muted-foreground">Rename, reorder, hide, and group sidebar items per role.</p>
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
              {orderedGroups.map((g, gIdx) => {
                const groupRows = rowsByGroup.get(g.id) || [];
                const isRoot = g.id === "__root__";
                const groupIdxInGroups = isRoot ? -1 : groups.findIndex((x) => x.id === g.id);
                return (
                  <div key={g.id} className="p-3">
                    <div className="flex items-center gap-2 mb-2">
                      {!isRoot && (
                        <div className="flex flex-col">
                          <button onClick={() => moveGroup(g.id, -1)} disabled={groupIdxInGroups <= 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30 h-3">
                            <ArrowUp className="h-3 w-3" />
                          </button>
                          <button onClick={() => moveGroup(g.id, 1)} disabled={groupIdxInGroups === groups.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30 h-3">
                            <ArrowDown className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                      {g.editable ? (
                        <Input
                          value={g.label}
                          onChange={(e) => renameGroup(g.id, e.target.value)}
                          className="h-7 text-[11px] uppercase tracking-wider font-semibold max-w-[200px]"
                        />
                      ) : (
                        <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">{g.label}</span>
                      )}
                      <span className="text-[10px] text-muted-foreground">({groupRows.length})</span>
                      <div className="flex-1" />
                      {g.editable && (
                        <Button size="icon" variant="ghost" onClick={() => deleteGroup(g.id)} title="Delete group" className="h-6 w-6">
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      )}
                    </div>
                    <div className="space-y-1">
                      {groupRows.map((r, idx) => {
                        return (
                          <div key={r.itemId} className={cn("flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/50", r.hidden && "opacity-50")}>
                            <div className="flex flex-col">
                              <button onClick={() => moveRow(r.itemId, -1)} disabled={idx === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30 h-3">
                                <ArrowUp className="h-3 w-3" />
                              </button>
                              <button onClick={() => moveRow(r.itemId, 1)} disabled={idx === groupRows.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30 h-3">
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
                      })}
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