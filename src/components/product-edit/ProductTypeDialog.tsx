import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useTranslation } from "next-i18next";
import { PackagePlus } from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";

type ProductType = "simple" | "variable";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (type: ProductType) => void;
}

export function ProductTypeDialog({ open, onOpenChange, onSelect }: Props) {
  const { t } = useTranslation("site");

  const OPTIONS: {
    type: ProductType;
    titleKey: string;
    descKey: string;
    image: string;
    bgTint: string;
    blobTint: string;
  }[] = [
    {
      type: "simple",
      titleKey: "productType.simple.title",
      descKey: "productType.simple.description",
      image: "/simple.png",
      bgTint: "bg-indigo-50/40",
      blobTint: "bg-indigo-100/70",
    },
    {
      type: "variable",
      titleKey: "productType.variable.title",
      descKey: "productType.variable.description",
      image: "/variable.png",
      bgTint: "bg-emerald-50/40",
      blobTint: "bg-emerald-100/60",
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden bg-background border-border">
        <div className="px-6 pt-4 pb-4">
          <div className="flex justify-center mb-2">
            <div className="h-9 w-9 rounded-md bg-indigo-100/70 flex items-center justify-center">
              <PackagePlus className="h-4.5 w-4.5 text-indigo-600" strokeWidth={2.2} />
            </div>
          </div>
          <h2 className="text-center text-base font-bold tracking-tight text-foreground">
            {t("productType.title")}
          </h2>
          <p className="text-center text-xs text-muted-foreground mt-0.5">
            {t("productType.subtitle")}
          </p>

          <div className="grid grid-cols-2 gap-3 mt-3">
            {OPTIONS.map((opt) => (
              <button
                key={opt.type}
                type="button"
                onClick={() => onSelect(opt.type)}
                className={cn(
                  "group relative flex flex-col items-center text-center rounded-xl p-3",
                  "border border-border/60 bg-card hover:border-foreground/20",
                  "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30",
                )}
              >
                <div className={cn(
                  "relative w-full aspect-[4/3] rounded-lg flex items-center justify-center overflow-hidden mb-2",
                  opt.bgTint,
                )}>
                  <div className={cn(
                    "absolute inset-x-4 inset-y-3 rounded-full blur-xl opacity-60",
                    opt.blobTint,
                  )} />
                  <div className="relative w-full h-full flex items-center justify-center p-2">
                    <Image
                      src={opt.image}
                      alt={t(opt.titleKey)}
                      width={160}
                      height={120}
                      className="object-contain max-h-full w-auto drop-shadow-sm"
                      priority
                    />
                  </div>
                </div>

                <h3 className="text-sm font-bold text-foreground mb-0.5">{t(opt.titleKey)}</h3>
                <p className="text-[11px] leading-snug text-muted-foreground max-w-[200px]">
                  {t(opt.descKey)}
                </p>
              </button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}