import { db } from "./db.js";

// Estima minutos de prática somando os intervalos entre mensagens consecutivas (de até
// 5 minutos) — não precisa de nenhuma instrumentação nova, só reaproveita created_at.
const GAP_CAP_MS = 5 * 60 * 1000;

export function estimatePracticeMinutes(): number {
  const rows = db.prepare("SELECT created_at FROM messages ORDER BY id").all() as { created_at: string }[];

  let totalMs = 0;
  for (let i = 1; i < rows.length; i++) {
    const prev = new Date(rows[i - 1].created_at).getTime();
    const curr = new Date(rows[i].created_at).getTime();
    const gap = curr - prev;
    if (gap > 0 && gap < GAP_CAP_MS) totalMs += gap;
  }
  return Math.round(totalMs / 60000);
}
