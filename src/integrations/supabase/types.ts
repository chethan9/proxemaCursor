import type { Database as DB } from "./database.types";

export type Database = DB;

export type Tab
...
pe Functions<T extends keyof Database["public"]["Functions"]> = Database["public"]["Functions"][T];


[Tool result trimmed: kept first 100 chars and last 100 chars of 630 chars.]