import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, Plus, X, Loader2 } from "lucide-react";
import { useWooTaxonomy } from "@/hooks/queries/useWooTaxonomy";
import { cn } from "@/lib/utils";

type Tag = { id?: number; name: string };

type Props = {
  storeId: string;
  selected: Tag[];
  onChange: (tags: Tag[]) => void;
  limit?: number;
};

export function TagPicker({ storeId, selected, onChange, limit = 15 }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [customInput, setCustomInput] = useState("");
  const { data: allTags = [], isLoading } = useWooTaxonomy(storeId, "tags");

  const selectedNames = useMemo(
    () => new Set(selected.map((t) => t.name.toLowerCase())),
    [selected]
  );

  const sortedTags = useMemo(() => {
    return [...allTags].sort(
      (a, b) => (b.count || 0) - (a.count || 0) || a.name.localeCompare(b.name)
    );
  }, [allTags]);

  const topTags = sortedTags.slice(0, limit);
  const remaining = Math.max(0, sortedTags.length - limit);

  const toggle = (tag: { id: number; name: string }) => {
    if (selectedNames.has(tag.name.toLowerCase())) {
      onChange(selected.filter((t) => t.name.toLowerCase() !== tag.name.toLowerCase()));
    } else {
      onChange([...selected, { id: tag.id, name: tag.name }]);
    }
  };

  const addCustom = (name: string) => {
    const t = name.trim();
    if (!t || selectedNames.has(t.toLowerCase())) return;
    const existing = allTags.find((x) => x.name.toLowerCase() === t.toLowerCase());
    onChange([...selected, existing ? { id: existing.id, name: existing.name } : { name: t }]);
  };

  const filteredDialog = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sortedTags;
    return sortedTags.filter((t) => t.name.toLowerCase().includes(q));
  }, [sortedTags, search]);

  const searchMatchesExact = search.trim()
    ? filteredDialog.some((t) => t.name.toLowerCase() === search.trim().toLowerCase())
    : true;

  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((t, i) => (
            <Badge key={t.id ?? `new-${i}`} variant="secondary" className="gap-1.5 py-1">
              {t.name}
              <button
                type="button"
                onClick={() => onChange(selected.filter((_, idx) => idx !== i))}
                aria-label={`Remove ${t.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {topTags.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-[11px] text-muted-foreground">Suggested</Label>
          <div className="flex flex-wrap gap-1.5">
            {topTags.map((t) => {
              const isSelected = selectedNames.has(t.name.toLowerCase());
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggle(t)}
                  className={cn(
                    "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border transition-colors",
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-muted border-border"
                  )}
                >
                  {isSelected ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                  {t.name}
                </button>
              );
            })}
            {remaining > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 rounded-full gap-1"
                onClick={() => setOpen(true)}
              >
                +{remaining} more
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Input
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustom(customInput);
              setCustomInput("");
            }
          }}
          onBlur={() => {
            if (customInput.trim()) {
              addCustom(customInput);
              setCustomInput("");
            }
          }}
          placeholder="Add custom tag"
          className="flex-1 text-sm h-9"
        />
        {allTags.length > 0 && (
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
            Browse all
          </Button>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Browse tags</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search or type new tag…"
                className="pl-9"
                autoFocus
              />
            </div>
            <div className="max-h-80 overflow-y-auto -mx-1 px-1">
              {isLoading ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                </div>
              ) : filteredDialog.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No tags match &quot;{search}&quot;
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {filteredDialog.map((t) => {
                    const isSelected = selectedNames.has(t.name.toLowerCase());
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => toggle(t)}
                        className={cn(
                          "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border transition-colors",
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background hover:bg-muted border-border"
                        )}
                      >
                        {isSelected ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                        {t.name}
                        {typeof t.count === "number" && t.count > 0 && (
                          <span className="text-[10px] opacity-60">({t.count})</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            {search.trim() && !searchMatchesExact && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  addCustom(search);
                  setSearch("");
                }}
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Create &quot;{search.trim()}&quot;
              </Button>
            )}
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => setOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
