import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useTranslation } from "next-i18next";
import { PackagePlus, Box, LayoutGrid, ArrowRight } from "lucide-react";
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
    badgeIcon: typeof Box;
    bgTint: string;
    blobTint: string;
    badgeBg: string;
    badgeColor: string;
    arrowBg: string;
    arrowColor: string;
    arrowHoverBg: string;
  }[] = [
    {
      type: "simple",
      titleKey: "productType.simple.title",
      descKey: "productType.simple.description",
      image: "/simple.png",
      badgeIcon: Box,
      bgTint: "bg-indigo-50/40",
      blobTint: "bg-indigo-100/70",
      badgeBg: "bg-indigo-100",
      badgeColor: "text-indigo-600",
      arrowBg: "bg-indigo-50",
      arrowColor: "text-indigo-600",
      arrowHoverBg: "group-hover:bg-indigo-600 group-hover:text-white",
    },
    {
      type: "variable",
      titleKey: "productType.variable.title",
      descKey: "productType.variable.description",
      image: "/variable.png",
      badgeIcon: LayoutGrid,
      bgTint: "bg-emerald-50/40",
      blobTint: "bg-emerald-100/60",
      badgeBg: "bg-emerald-100",
      badgeColor: "text-emerald-600",
      arrowBg: "bg-emerald-50",
      arrowColor: "text-emerald-600",
      arrowHoverBg: "group-hover:bg-emerald-600 group-hover:text-white",
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 overflow-hidden bg-background border-border">
        <div className="px-5 pt-5 pb-4">
          <div className="flex justify-center mb-2.5">
            <div className="h-9 w-9 rounded-md bg-indigo-100/70 flex items-center justify-center">
              <PackagePlus className="h-4.5 w-4.5 text-indigo-600" strokeWidth={2.2} />
            </div>
          </div>
          <h2 className="text-center text-base font-bold tracking-tight text-foreground">
            {t("productType.title")}
          </h2>
          <p className="text-center text-xs text-muted-foreground mt-1">
            {t("productType.subtitle")}
          </p>

          <div className="grid grid-cols-2 gap-3 mt-4">
            {OPTIONS.map((opt) => {
              const BadgeIcon = opt.badgeIcon;
              return (
                <button
                  key={opt.type}
                  type="button"
                  onClick={() => onSelect(opt.type)}
                  className={cn(
                    "group relative flex flex-col items-center text-center rounded-xl p-3 pb-3.5",
                    "border border-border/60 bg-card hover:border-foreground/20",
                    "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30",
                  )}
                >
                  <div className={cn(
                    "relative w-full aspect-[4/3] rounded-lg flex items-center justify-center overflow-hidden mb-2.5",
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
                        width={144}
                        height={108}
                        className="object-contain max-h-full w-auto drop-shadow-sm"
                        priority
                      />
                    </div>
                  </div>

                  <div className={cn(
                    "h-6 w-6 rounded-full flex items-center justify-center mb-2 -mt-1",
                    opt.badgeBg,
                  )}>
                    <BadgeIcon className={cn("h-3 w-3", opt.badgeColor)} strokeWidth={2.2} />
                  </div>

                  <h3 className="text-sm font-bold text-foreground mb-1">{t(opt.titleKey)}</h3>
                  <p className="text-[11px] leading-snug text-muted-foreground max-w-[180px] mb-2.5">
                    {t(opt.descKey)}
                  </p>

                  <div className={cn(
                    "h-6 w-6 rounded-full flex items-center justify-center transition-all",
                    opt.arrowBg, opt.arrowColor, opt.arrowHoverBg,
                    "group-hover:scale-110",
                  )}>
                    <ArrowRight className="h-3 w-3" strokeWidth={2.4} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}