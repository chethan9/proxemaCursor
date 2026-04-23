import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
const CS = ["USD","INR","KWD","SAR","AED","EUR","GBP"];
export function CurrencySwitcher({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (<Select value={value} onValueChange={onChange}><SelectTrigger className="w-24 h-8"><SelectValue /></SelectTrigger><SelectContent>{CS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>);
}