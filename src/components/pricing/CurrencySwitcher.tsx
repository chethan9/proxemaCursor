import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/selec
...
ies.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}