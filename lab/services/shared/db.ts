import pg from "pg";
import { pause } from "./parse.js";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.PG_POOL || 10),
});

export async function waitForPostgres(): Promise<void> {
  for (let remaining = 30; remaining > 0; remaining -= 1) {
    try {
      await pool.query("SELECT 1");
      return;
    } catch {
      await pause(1000);
    }
  }
  throw new Error("postgres did not become ready");
}
