import { drizzle, DrizzleD1Database } from "drizzle-orm/d1";

export type DB = DrizzleD1Database;

export function getDb(d1: D1Database): DB {
  return drizzle(d1);
}
