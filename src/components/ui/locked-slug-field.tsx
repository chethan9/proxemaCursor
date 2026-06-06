import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lock, Unlock } from "lucide-react";

export interface LockedSlugFieldProps {
  id?: string;
  value: string;
  committedValue?: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  placeholder?: string;
  maxLength?: number;
  showHint?: boolean;
  className?: string;
}

export function LockedSlugField({
  id,
  value,
  committedValue,
  onChange,
  disabled,
  placeholder,
  maxLength,
  showHint,
  className,
}: LockedSlugFieldProps) {
  const hasCommitted = typeof committedValue === "string" && committedValue.length > 0;
  const [unlocked, setUnlocked] = useState<boolean>(!hasCommitted);

  useEffect(() => {
    if (!hasCommitted) setUnlocked(true);
  }, [hasCommitted]);

  const isDisabled = Boolean(disabled) || (hasCommitted && !unlocked);

  return (
    <div className={`space-y-1 ${className ?? ""}`.trim()}>
      <div className="flex items-stretch gap-2">
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={isDisabled}
          placeholder={placeholder}
          maxLength={maxLength}
          className="h-9 bg-background font-mono text-sm"
          autoComplete="off"
          spellCheck={false}
        />
        {hasCommitted ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 shrink-0 gap-1.5"
            onClick={() => setUnlocked((v) => !v)}
            disabled={Boolean(disabled)}
            aria-label={unlocked ? "Lock slug" : "Unlock slug"}
            title={unlocked ? "Lock slug" : "Unlock slug"}
          >
            {unlocked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
            <span className="text-xs">{unlocked ? "Lock" : "Edit"}</span>
          </Button>
        ) : null}
      </div>
      {showHint ? (
        <p className="text-[11px] text-muted-foreground">
          Lowercase letters, numbers and hyphens. Used in URLs.
        </p>
      ) : null}
    </div>
  );
}

export default LockedSlugField;
