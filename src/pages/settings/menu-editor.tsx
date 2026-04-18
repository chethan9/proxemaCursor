import { useEffect, useState, useCallback } from "react";
import { SettingsLayout } from "@/components/layout/SettingsLayout";
import { AuthGuard } from "@/components/AuthGuard";
import { useAuth } from "@/contexts/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  getMenuConfig, saveMenuConfig, resetMenuConfig,
  getSiteMenuConfigRaw, saveSiteMenuConfig, resetSiteMenuConfig,
  type MenuNode,
} from "@/services/menuConfigService";
import { listRoles, type RoleRow } from "@/services/userService";
import { getStores, type StoreWithClient } from "@/services/storeService";
import { mergeMenu, mergeSiteMenu } from "@/lib/menu-merge";
import { IconPicker } from "@/components/menu-editor/IconPicker";
import { ColorPicker } from "@/components/menu-editor/ColorPicker";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Eye, EyeOff, Trash2, FolderPlus, ChevronDown, ChevronRight, Plus, Loader2, Globe, Store as StoreIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Scope = "global" | "site";

function humanizeRole(name: string): string {
  return name.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function SortableRow({ node, depth, onUpdate, onDelete, onToggleHidden, onAddChild, expanded, onToggleExpand }: {
  node: MenuNode;
  depth: number;
  onUpdate: (n: MenuNode) => void;
  onDelete: () => void;
  onToggleHidden: () => void;
  onAddChild?: () => void;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: node.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const hasChildren = node.type === "group" || (node.children && node.children.length > 0);

  return (
    <div ref={setNodeRef} style={style} className={cn("flex items-center gap-2 py-1.5 px-2 rounded-md bg-card border border-border", node.hidden && "opacity-50")}>
      <button {...attributes} {...listeners} className="cursor-grab touch-none text-muted-foreground hover:text-foreground" aria-label="Drag">
        <GripVertical className="h-4 w-4" />
      </button>
      {hasChildren ? (
        <button onClick={onToggleExpand} className="text-muted-foreground hover:text-foreground">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      ) : (
        <span className="w-4" />
      )}
      <IconPicker value={node.icon} color={node.iconColor} onChange={(icon) => onUpdate({ ...node, icon })} />
      <ColorPicker value={node.iconColor} onChange={(iconColor) => onUpdate({ ...node, iconColor })} />
      <div className="flex-1 flex items-center gap-2 min-w-0">
        <Input value={node.label} onChange={(e) => onUpdate({ ...node, label: e.target.value })} className="h-8 text-sm" />
        {node.type === "group" && <span className="text-[10px] uppercase tracking-wider text-muted-foreground px-1.5 py-0.5 bg-muted rounded">Group</span>}
      </div>
      {node.type === "group" && depth === 0 && onAddChild && (
        <Button size="icon" variant="ghost" onClick={onAddChild} title="Add child"><Plus className="h-4 w-4" /></Button>
      )}
      <Button size="icon" variant="ghost" onClick={onToggleHidden} title={node.hidden ? "Show" : "Hide"}>
        {node.hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </Button>
      {node.type === "group" && node.id.startsWith("group-custom-") && (
        <Button size="icon" variant="ghost" onClick={onDelete} title="Delete group"><Trash2 className="h-4 w-4 text-destructive" /></Button>
      )}
    </div>
  );
}

function MenuEditorInner() {
  const { isSuperAdmin } = useAuth();
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [role, setRole] = useState<string>("");
  const [scope, setScope] = useState<Scope>("global");
  const [sites, setSites] = useState<StoreWithClient[]>([]);
  const [siteId, setSiteId] = useState<string>("__default__"); // "__default__" = all-sites fallback
  const [tree, setTree] = useState<MenuNode[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [unassignedCount, setUnassignedCount] = useState(0);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  useEffect(() => {
    listRoles().then((rs) => {
      setRoles(rs);
      if (rs.length > 0 && !role) setRole(rs[0].name);
    }).catch((e) => toast({ title: "Failed to load roles", description: (e as Error).message, variant: "destructive" }));
    getStores().then(setSites).catch(() => { /* non-blocking */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async (r: string, s: Scope, sId: string) => {
    if (!r) return;
    setLoading(true);
    try {
      let merged: MenuNode[];
      let unassignedIds: string[];
      if (s === "global") {
        const cfg = await getMenuConfig(r);
        ({ tree: merged, unassignedIds } = mergeMenu(cfg));
      } else {
        const actualSiteId = sId === "__default__" ? null : sId;
        const cfg = await getSiteMenuConfigRaw(r, actualSiteId);
        ({ tree: merged, unassignedIds } = mergeSiteMenu(cfg));
      }
      setTree(merged);
      setUnassignedCount(unassignedIds.length);
      const exp: Record<string, boolean> = {};
      merged.forEach((n) => { exp[n.id] = true; });
      setExpanded(exp);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (role) load(role, scope, siteId); }, [role, scope, siteId, load]);

  const handleTopDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = tree.findIndex((n) => n.id === active.id);
    const newIdx = tree.findIndex((n) => n.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    setTree(arrayMove(tree, oldIdx, newIdx));
  };

  const handleChildDragEnd = (parentId: string) => (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setTree((t) => t.map((n) => {
      if (n.id !== parentId || !n.children) return n;
      const oldIdx = n.children.findIndex((c) => c.id === active.id);
      const newIdx = n.children.findIndex((c) => c.id === over.id);
      if (oldIdx < 0 || newIdx < 0) return n;
      return { ...n, children: arrayMove(n.children, oldIdx, newIdx) };
    }));
  };

  const updateNode = (id: string, updated: MenuNode) => {
    setTree((t) => t.map((n) => {
      if (n.id === id) return updated;
      if (n.children) return { ...n, children: n.children.map((c) => c.id === id ? updated : c) };
      return n;
    }));
  };

  const deleteNode = (id: string) => {
    setTree((t) => t.filter((n) => n.id !== id).map((n) => n.children ? { ...n, children: n.children.filter((c) => c.id !== id) } : n));
  };

  const toggleHidden = (id: string) => {
    setTree((t) => t.map((n) => {
      if (n.id === id) return { ...n, hidden: !n.hidden };
      if (n.children) return { ...n, children: n.children.map((c) => c.id === id ? { ...c, hidden: !c.hidden } : c) };
      return n;
    }));
  };

  const addGroup = () => {
    const id = `group-custom-${Date.now()}`;
    setTree((t) => [...t, { id, type: "group", label: "New Group", icon: "Folder", children: [] }]);
    setExpanded((e) => ({ ...e, [id]: true }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (scope === "global") {
        await saveMenuConfig(role, tree);
      } else {
        const actualSiteId = siteId === "__default__" ? null : siteId;
        await saveSiteMenuConfig(role, actualSiteId, tree);
      }
      const scopeLabel = scope === "global"
        ? "global menu"
        : siteId === "__default__" ? "default site menu" : `site: ${sites.find((s) => s.id === siteId)?.name || siteId}`;
      toast({ title: "Saved", description: `${humanizeRole(role)} ${scopeLabel} updated.` });
    } catch (err) {
      toast({ title: "Save failed", description: (err as Error).message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleReset = async () => {
    const target = scope === "global"
      ? "global menu"
      : siteId === "__default__" ? "default site menu" : `site-specific menu`;
    if (!confirm(`Reset ${humanizeRole(role)} ${target} to defaults?`)) return;
    if (scope === "global") {
      await resetMenuConfig(role);
    } else {
      const actualSiteId = siteId === "__default__" ? null : siteId;
      await resetSiteMenuConfig(role, actualSiteId);
    }
    await load(role, scope, siteId);
    toast({ title: "Reset", description: "Menu restored to defaults." });
  };

  if (roles.length === 0 && !loading) {
    return <div className="p-6 text-sm text-muted-foreground">No roles found. Create roles in Settings → Roles first.</div>;
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Menu Editor</h1>
        <p className="text-sm text-muted-foreground">Customize sidebar menu per role and scope. Changes apply on next reload.</p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3 p-3 rounded-md border border-border bg-muted/30">
        <div className="flex items-center gap-1 p-0.5 rounded-md bg-background border border-border">
          <button
            onClick={() => setScope("global")}
            className={cn("flex items-center gap-1.5 px-3 py-1 rounded-sm text-xs font-medium transition-colors",
              scope === "global" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            <Globe className="h-3.5 w-3.5" /> Global menu
          </button>
          <button
            onClick={() => setScope("site")}
            className={cn("flex items-center gap-1.5 px-3 py-1 rounded-sm text-xs font-medium transition-colors",
              scope === "site" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            <StoreIcon className="h-3.5 w-3.5" /> Site menu
          </button>
        </div>
        {scope === "site" && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Target:</span>
            <Select value={siteId} onValueChange={setSiteId}>
              <SelectTrigger className="h-8 w-[240px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__default__">All sites (default)</SelectItem>
                {sites.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex-1" />
        <p className="text-[11px] text-muted-foreground max-w-xs text-right">
          {scope === "global"
            ? "Controls the main sidebar visible everywhere outside a site."
            : siteId === "__default__"
              ? "Default menu shown inside every site unless a specific override exists."
              : "Overrides the default for this site only."}
        </p>
      </div>

      {roles.length > 0 && (
        <Tabs value={role} onValueChange={setRole} className="mb-4">
          <TabsList className="flex-wrap h-auto">
            {roles.map((r) => <TabsTrigger key={r.id} value={r.name}>{humanizeRole(r.name)}</TabsTrigger>)}
          </TabsList>
        </Tabs>
      )}

      {unassignedCount > 0 && (
        <div className="mb-4 p-3 rounded-md bg-warning/10 border border-warning/30 text-sm">
          <strong>{unassignedCount}</strong> new page{unassignedCount > 1 ? "s" : ""} auto-added. Drag them into the desired group.
        </div>
      )}

      <div className="flex gap-2 mb-4">
        <Button size="sm" variant="outline" onClick={addGroup}><FolderPlus className="h-4 w-4 mr-1.5" />Add Group</Button>
        <Button size="sm" variant="outline" onClick={handleReset}>Reset to Defaults</Button>
        <div className="flex-1" />
        <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
      </div>

      <Card>
        <CardContent className="p-4">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleTopDragEnd}>
              <SortableContext items={tree.map((n) => n.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-1.5">
                  {tree.map((node) => (
                    <div key={node.id}>
                      <SortableRow
                        node={node}
                        depth={0}
                        expanded={!!expanded[node.id]}
                        onToggleExpand={() => setExpanded((e) => ({ ...e, [node.id]: !e[node.id] }))}
                        onUpdate={(n) => updateNode(node.id, n)}
                        onDelete={() => deleteNode(node.id)}
                        onToggleHidden={() => toggleHidden(node.id)}
                      />
                      {expanded[node.id] && node.children && node.children.length > 0 && (
                        <div className="ml-8 mt-1 space-y-1">
                          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleChildDragEnd(node.id)}>
                            <SortableContext items={node.children.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                              {node.children.map((child) => (
                                <SortableRow
                                  key={child.id}
                                  node={child}
                                  depth={1}
                                  expanded={false}
                                  onToggleExpand={() => {}}
                                  onUpdate={(n) => updateNode(child.id, n)}
                                  onDelete={() => deleteNode(child.id)}
                                  onToggleHidden={() => toggleHidden(child.id)}
                                />
                              ))}
                            </SortableContext>
                          </DndContext>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>

      {!isSuperAdmin && (
        <p className="mt-4 text-xs text-muted-foreground">Note: Only super admins can modify menu configurations.</p>
      )}
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