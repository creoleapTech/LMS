import { Database } from "bun:sqlite";
import * as path from "path";

const dbPath = path.join(
  "C:",
  "Users",
  "chris",
  "Desktop",
  "LMS",
  "server-cf",
  ".wrangler",
  "state",
  "v3",
  "d1",
  "miniflare-D1DatabaseObject",
  "0f88d7310c7a99f274955b8d900b8aeaffc5aced59c29af90ccc92edba7754fc.sqlite"
);

console.log("Connecting to:", dbPath);
const db = new Database(dbPath);

// List all tables
const tables = db.query("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log("Tables in database:", tables.map((t: any) => t.name));

// Check for Creoleap International School
console.log("\n--- Searching for Creoleap Institutions ---");
const institutions = db.query("SELECT * FROM institutions WHERE name LIKE '%creoleap%'").all();
console.log("Institutions found:", JSON.stringify(institutions, null, 2));

if (institutions.length > 0) {
  for (const inst of institutions as any[]) {
    console.log(`\n--- Quizzes for ${inst.name} (ID: ${inst.id}) ---`);
    const quizzes = db.query("SELECT * FROM institution_quizzes WHERE institution_id = ?").all(inst.id);
    console.log("Quizzes found:", JSON.stringify(quizzes, null, 2));
  }
} else {
  console.log("No Creoleap institutions found. Listing all institutions:");
  const allInst = db.query("SELECT * FROM institutions").all();
  console.log(JSON.stringify(allInst, null, 2));
}
