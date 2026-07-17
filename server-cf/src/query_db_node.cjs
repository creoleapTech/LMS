const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const dbPath = path.join(
  'C:',
  'Users',
  'chris',
  'Desktop',
  'LMS',
  'server-cf',
  '.wrangler',
  'state',
  'v3',
  'd1',
  'miniflare-D1DatabaseObject',
  '0f88d7310c7a99f274955b8d900b8aeaffc5aced59c29af90ccc92edba7754fc.sqlite'
);

console.log("Database path:", dbPath);
try {
  const db = new DatabaseSync(dbPath);
  
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log("\nTables in database:", tables.map(t => t.name).join(", "));
  
  // Search institutions
  const insts = db.prepare("SELECT * FROM institutions").all();
  console.log("\nInstitutions:", insts);
  
  // Search quizzes
  const quizzes = db.prepare("SELECT * FROM institution_quizzes").all();
  console.log("\nQuizzes:", quizzes);

} catch (err) {
  console.error("Error executing script:", err);
}
