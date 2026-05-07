import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useTranslation } from "next-i18next";

interface Props {
  currencies: { code: string; count: number }[];
  selected: string;
  onChange: (code: string) => void;
  includeAll?: boolean;
  allSelected?: boolean;
  allLabel?: string;
}

export function CurrencySwitcher({
  currencies,
  selected,
  onChange,
  includeAll = false,
  allSelected = false,
  allLabel = "All",
}: Props) {
  const { t } = useTranslation("site");
  const { t: tCommon } = useTranslation("common");
  const visibleCurrencies = currencies.slice(0, 5);
  const hiddenCurrencies = currencies.slice(5);
  const collapseCurrencies = allSelected;

  if (!currencies || currencies.length === 0) return null;
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border bg-background p-1 shadow-sm">
      {includeAll && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onChange("__all__")}
          className={cn(
            "h-7 px-3 text-xs font-semibold transition-colors",
            allSelected
              ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
              : "text-muted-foreground hover:bg-muted"
          )}
          title={allLabel}
        >
          {allLabel}
        </Button>
      )}
      {!collapseCurrencies &&
        visibleCurrencies.map((c) => (
          <Button
            key={c.code}
            size="sm"
            variant="ghost"
            onClick={() => onChange(c.code)}
            className={cn(
              "h-7 px-3 text-xs font-mono font-semibold transition-colors",
              selected === c.code
                ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            )}
            title={t("home.cards.currencyTooltip", { count: c.count, code: c.code })}
          >
            {c.code}
            <span className="ml-1.5 opacity-70 tabular-nums">{c.count}</span>
          </Button>
        ))}
      {(hiddenCurrencies.length > 0 || collapseCurrencies) && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted"
              title={tCommon("actions.more")}
            >
              +{tCommon("actions.more")}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[220px] p-1.5">
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {currencies.map((c) => (
                <Button
                  key={`more-${c.code}`}
                  size="sm"
                  variant="ghost"
                  onClick={() => onChange(c.code)}
                  className={cn(
                    "h-8 w-full justify-between px-2.5 font-mono text-xs",
                    selected === c.code && !allSelected
                      ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                      : "text-foreground hover:bg-muted"
                  )}
                >
                  <span>{c.code}</span>
                  <span className="opacity-70 tabular-nums">{c.count}</span>
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}