import { db } from "./db.js";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// Chamado a cada mensagem de chat — é o sinal de "usou o app hoje". Registra o dia
// (se ainda não tiver sido registrado) e devolve a sequência atualizada.
export function touchStreak(): { current: number; isNewDay: boolean } {
  const existedToday = db.prepare("SELECT 1 FROM activity_log WHERE date = ?").get(todayISO());
  if (!existedToday) {
    db.prepare("INSERT INTO activity_log (date) VALUES (?)").run(todayISO());
  }
  return { current: computeCurrentStreak(), isNewDay: !existedToday };
}

export function computeCurrentStreak(): number {
  const rows = db.prepare("SELECT date FROM activity_log").all() as { date: string }[];
  const dates = new Set(rows.map((r) => r.date));

  let streak = 0;
  const cursor = new Date();
  while (dates.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function weekCount(): number {
  const since = new Date();
  since.setDate(since.getDate() - 6);
  const sinceISO = since.toISOString().slice(0, 10);

  const row = db.prepare("SELECT COUNT(*) as c FROM activity_log WHERE date >= ?").get(sinceISO) as {
    c: number;
  };
  return row.c;
}
