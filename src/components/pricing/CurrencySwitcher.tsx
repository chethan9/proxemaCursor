import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getSupportedCountries, getDefaultCurrencyForCountry } from "@/lib/payments/routing";
import { Globe } from "lucide-react";

export function CurrencySwitcher({ country, onChange }: { country: string; onChange: (country: string, currency: string) => void }) {
  const countries = getSupportedCountries();
  const regions = Array.from(new Set(countries.map((c) => c.region)));
  return (
    <Select value={country} onValueChange={(c) => onChange(c, getDefaultCurrencyForCountry(c))}>
      <SelectTrigger className="w-[200px] h-9 gap-2">
        <Globe className="h-4 w-4 text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-[360px]">
        {regions.map((region) => (
          <SelectGroup key={region}>
            <SelectLabel>{region}</SelectLabel>
            {countries.filter((c) => c.region === region).map((c) => (
              <SelectItem key={c.code} value={c.code}>
                {c.name} · {c.currency}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}