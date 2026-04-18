export type ViewMode = "table" | "grid" | "compact";

export interface ViewModeToggleProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
}

export function ViewModeToggle(_props: ViewModeToggleProps) {
  return null;
}