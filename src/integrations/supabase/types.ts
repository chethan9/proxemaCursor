<![CDATA[
import type { Database as DB } from './database.types';

export type Database = DB;

expor
...
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T];
]]>

[Tool result trimmed: kept first 100 chars and last 100 chars of 534 chars.]