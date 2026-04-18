import { useEffect, useState, useCallback } from "react";
import { SettingsLayout } from "@/components/layout/SettingsLayout";
import { AuthGuard } from "@/components/AuthGuard";
import { useAuth } from "@/contexts/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { getMenuConfig, saveMenuConfig, resetMenuConfig, type MenuNode, type RoleKey } from "@/services/menuConfigService";
import { mergeMenu } from "@/lib/menu-merge";
import { IconPicker } from "@/components/menu-editor/IconPicker";
import { ColorPicker } from "@/components/menu-editor/ColorPicker";
import { resolveIcon } from "@/lib/menu-registry";
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
import { GripVertical, Eye, EyeOff, Trash2, FolderPlus, ChevronDown, ChevronRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const ROLES: { key: RoleKey; label: string }[] = [
  { key: "super_admin", label: "Super Admin" },
  { key: "admin", label: "Admin" },
  { key: "staff", label: "Staff" },
  { key: "readonly", label: "Read-only" },
];

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
  const Icon = resolveIcon(node.icon);

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
  const [role, setRole] = useState<RoleKey>("super_admin");
  const [tree, setTree] = useState<MenuNode[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [unassignedCount, setUnassignedCount] = useState(0);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const load = useCallback(async (r: RoleKey) => {
    setLoading(true);
    try {
      const cfg = await getMenuConfig(r);
      const { tree: merged } = mergeMenu(cfg);
      setTree(merged);
      const unassigned = merged.find((n) => n.id === "group-unassigned");
      setUnassignedCount(unassigned?.children?.length || 0);
      const exp: Record<string, boolean> = {};
      merged.forEach((n) => { exp[n.id] = true; });
      setExpanded(exp);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(role); }, [role, load]);

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
      await saveMenuConfig(role, tree);
      toast({ title: "Saved", description: `Menu for ${role} updated.` });
    } catch (err) {
      toast({ title: "Save failed", description: (err as Error).message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleReset = async () => {
    if (!confirm(`Reset menu for ${role} to defaults?`)) return;
    await resetMenuConfig(role);
    await load(role);
    toast({ title: "Reset", description: "Menu restored to defaults." });
  };

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Menu Editor</h1>
        <p className="text-sm text-muted-foreground">Customize sidebar menu per role. Changes apply on next reload.</p>
      </div>

      <Tabs value={role} onValueChange={(v) => setRole(v as RoleKey)} className="mb-4">
        <TabsList>
          {ROLES.map((r) => <TabsTrigger key={r.key} value={r.key}>{r.label}</TabsTrigger>)}
        </TabsList>
      </Tabs>

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
            <div className="text-sm text-muted-foreground py-8 text-center">Loading...</div>
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