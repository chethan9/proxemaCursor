import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface NumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value: string | number | null | undefined;
  onValueChange: (value: string) => void;
  integer?: boolean;
  allowNegative?: boolean;
}

export function numericRegex(integer = false, allowNegative = false): RegExp {
  const sign = allowNegative ? "-?" : "";
  return integer ? new RegExp(`^${sign}\\d*$`) : new RegExp(`^${sign}\\d*(\\.\\d*)?$`);
}

export function isValidNumericString(s: string, integer = false, allowNegative = false): boolean {
  if (s === "" || s === "-") return allowNegative || s === "";
  return numericRegex(integer, allowNegative).test(s);
}

export const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  ({ value, onValueChange, integer = false, allowNegative = false, className, inputMode, ...rest }, ref) => {
    const stringValue = value == null ? "" : String(value);
    const re = numericRegex(integer, allowNegative);

    return (
      <Input
        {...rest}
        ref={ref}
        type="text"
        inputMode={inputMode || (integer ? "numeric" : "decimal")}
        className={cn(className)}
        value={stringValue}
        onChange={(e) => {
          const next = e.target.value;
          if (next === "" || (allowNegative && next === "-") || re.test(next)) {
            onValueChange(next);
          }
        }}
        onPaste={(e) => {
          const text = e.clipboardData.getData("text");
          if (text && !re.test(text) && !(allowNegative && text === "-")) {
            e.preventDefault();
          }
        }}
      />
    );
  },
);
NumberInput.displayName = "NumberInput";