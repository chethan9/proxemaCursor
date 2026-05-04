import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { ProductFormState } from "@/services/productEditService";
import { CheckCircle2, ChevronDown, Clock, FileEdit, Lock } from "lucide-react";
import { useTranslation } from "next-i18next";
import { useMemo } from "react";

const STATUS_DEFS: {
  value: ProductFormState["status"];
  labelKey: string;
  descKey: string;
  Icon: typeof CheckCircle2;
  triggerWrap: string;
  triggerIcon: string;
}[] = [
  {
    value: "publish",
    labelKey: "products.productStatus.publish.label",
    descKey: "products.productStatus.publish.description",
    Icon: CheckCircle2,
    triggerWrap: "bg-emerald-500/15",
    triggerIcon: "text-emerald-600",
  },
  {
    value: "draft",
    labelKey: "products.productStatus.draft.label",
    descKey: "products.productStatus.draft.description",
    Icon: FileEdit,
    triggerWrap: "bg-muted",
    triggerIcon: "text-muted-foreground",
  },
  {
    value: "pending",
    labelKey: "products.productStatus.pending.label",
    descKey: "products.productStatus.pending.description",
    Icon: Clock,
    triggerWrap: "bg-amber-500/15",
    triggerIcon: "text-amber-600",
  },
  {
    value: "private",
    labelKey: "products.productStatus.private.label",
    descKey: "products.productStatus.private.description",
    Icon: Lock,
    triggerWrap: "bg-slate-500/15",
    triggerIcon: "text-slate-600",
  },
];

type Props = {
  value: ProductFormState["status"];
  onChange: (next: ProductFormState["status"]) => void;
  disabled?: boolean;
  className?: string;
};

export function ProductStatusDropdown({ value, onChange, disabled, className }: Props) {
  const { t } = useTranslation("site");

  const options = useMemo(
    () =>
      STATUS_DEFS.map((d) => ({
        ...d,
        label: t(d.labelKey),
        description: t(d.descKey),
      })),
    [t],
  );

  const selected = options.find((o) => o.value === value) ?? options[0];
  const SelectedIcon = selected.Icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <button
          type="button"
          className={cn(
            "inline-flex h-9 max-w-full items-center gap-2 rounded-full border border-border bg-card px-2.5 py-1 text-sm shadow-sm transition-colors",
            "hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background",
            "disabled:pointer-events-none disabled:opacity-50",
            className,
          )}
          aria-label={`${t("products.filters.status")}: ${selected.label}`}
        >
          <span className={cn("inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full", selected.triggerWrap)}>
            <SelectedIcon className={cn("h-3.5 w-3.5", selected.triggerIcon)} aria-hidden />
          </span>
          <span className="min-w-0 truncate font-medium">{selected.label}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[min(100vw-2rem,260px)]">
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(v) => onChange(v as ProductFormState["status"])}
        >
          {options.map((opt) => {
            const OIcon = opt.Icon;
            return (
              <DropdownMenuRadioItem
                key={opt.value}
                value={opt.value}
                className="cursor-pointer items-start gap-2.5 py-2.5 pl-8 pr-2"
              >
                <span
                  className={cn(
                    "mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    opt.triggerWrap,
                  )}
                  aria-hidden
                >
                  <OIcon className={cn("h-4 w-4", opt.triggerIcon)} />
                </span>
                <span className="flex min-w-0 flex-col gap-0.5 text-left leading-snug">
                  <span className="font-medium">{opt.label}</span>
                  <span className="text-[11px] font-normal text-muted-foreground">{opt.description}</span>
                </span>
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
