import Database from "better-sqlite3";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const db = new Database(join(__dirname, "..", "papo-reto.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    author TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

// App de usuário único: sempre uma única linha, id fixo em 1.
db.exec(`
  CREATE TABLE IF NOT EXISTS profile (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    name TEXT NOT NULL,
    goal TEXT NOT NULL,
    level TEXT NOT NULL,
    mode TEXT NOT NULL CHECK (mode IN ('normal', 'brava'))
  )
`);

// Fase 11: motor de conversa (Ollama local ou Gemini com a chave do próprio usuário).
// ALTER TABLE em vez de recriar a CREATE TABLE acima, pra não perder o profile de quem
// já tinha o app instalado antes desta fase.
const profileColumns = new Set(
  (db.prepare("PRAGMA table_info(profile)").all() as { name: string }[]).map((c) => c.name)
);
if (!profileColumns.has("engine")) {
  db.exec("ALTER TABLE profile ADD COLUMN engine TEXT NOT NULL DEFAULT 'ollama'");
}
if (!profileColumns.has("gemini_api_key")) {
  db.exec("ALTER TABLE profile ADD COLUMN gemini_api_key TEXT");
}

db.exec(`
  CREATE TABLE IF NOT EXISTS lesson_progress (
    lesson_id TEXT PRIMARY KEY,
    completed_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

// Um dia vira uma linha aqui na primeira interação do dia — serve tanto pra sequência
// (dias consecutivos terminando hoje) quanto pro contador semanal, sem duplicar lógica.
db.exec(`
  CREATE TABLE IF NOT EXISTS activity_log (
    date TEXT PRIMARY KEY
  )
`);

// Toda vez que o agente corrige o aluno (practicePhrase diferente do texto original),
// vira candidata a revisão. "Recorrente" é medido pela contagem de quantas vezes a
// mesma frase corrigida aparece.
db.exec(`
  CREATE TABLE IF NOT EXISTS mistakes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_text TEXT NOT NULL,
    correct_phrase TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);
