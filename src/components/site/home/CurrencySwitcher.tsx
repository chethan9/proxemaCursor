import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslation } from "next-i18next";

interface Props {
  currencies: { code: string; count: number }[];
  selected: string;
  onChange: (code: string) => void;
}

export function CurrencySwitcher({ currencies, selected, onChange }: Props) {
  const { t } = useTranslation("site");
  if (!currencies || currencies.length <= 1) return null;
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border bg-background p-1 shadow-sm">
      {currencies.map((c) => (
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
    </div>
  );
}