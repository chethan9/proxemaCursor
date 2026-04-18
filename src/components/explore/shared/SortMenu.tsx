export interface SortMenuProps {
  field: string;
  direction: "asc" | "desc";
  onChange: (field: string, direction: "asc" | "desc") => void;
  options: { value: string; label: string }[];
}

export function SortMenu(_props: SortMenuProps) {
  return null;
}