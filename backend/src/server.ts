import Fastify from "fastify";
import cors from "@fastify/cors";
import { PassThrough } from "node:stream";
import { db } from "./db.js";
import { streamAgent, nextMood, type ChatMessage, type Mode } from "./agent.js";
import { curriculum, quiz, scoreQuiz } from "./content.js";
import { synthesizeSpeech, extractPracticePhrase } from "./tts.js";
import { touchStreak, computeCurrentStreak, weekCount } from "./streak.js";
import { estimatePracticeMinutes } from "./stats.js";

const app = Fastify();
await app.register(cors, { origin: true });

const HISTORY_LIMIT = 20;

type Profile = { id: 1; name: string; goal: string; level: string; mode: Mode };

app.get("/api/health", async () => ({ ok: true }));

app.get("/api/profile", async () => {
  const profile = db.prepare("SELECT * FROM profile WHERE id = 1").get() as Profile | undefined;
  return { profile: profile ?? null };
});

app.post<{ Body: Omit<Profile, "id"> }>("/api/profile", async (request) => {
  const { name, goal, level, mode } = request.body;
  db.prepare(
    `INSERT INTO profile (id, name, goal, level, mode) VALUES (1, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name = ?, goal = ?, level = ?, mode = ?`
  ).run(name, goal, level, mode, name, goal, level, mode);
  return { ok: true };
});

app.get("/api/placement-quiz", async () => ({
  questions: quiz.questions.map(({ id, level, text, options }) => ({ id, level, text, options })),
}));

app.post<{ Body: { answers: Record<string, string> } }>("/api/placement-quiz", async (request) => {
  const level = scoreQuiz(request.body.answers);
  db.prepare("UPDATE profile SET level = ? WHERE id = 1").run(level);
  return { level };
});

app.get("/api/curriculum", async () => {
  const done = new Set(
    (db.prepare("SELECT lesson_id FROM lesson_progress").all() as { lesson_id: string }[]).map(
      (r) => r.lesson_id
    )
  );
  const levels = curriculum.levels.map((group) => ({
    ...group,
    lessons: group.lessons.map((lesson) => ({ ...lesson, completed: done.has(lesson.id) })),
  }));
  return { levels };
});

app.post<{ Params: { id: string } }>("/api/lessons/:id/complete", async (request) => {
  db.prepare("INSERT OR IGNORE INTO lesson_progress (lesson_id) VALUES (?)").run(request.params.id);
  return { ok: true };
});

app.get("/api/streak", async () => ({
  current: computeCurrentStreak(),
  weekCount: weekCount(),
}));

app.get("/api/dashboard", async () => {
  const profile = db.prepare("SELECT * FROM profile WHERE id = 1").get() as Profile | undefined;
  const lessonsCompleted = (db.prepare("SELECT COUNT(*) as c FROM lesson_progress").get() as { c: number }).c;
  const totalLessons = curriculum.levels.reduce((sum, g) => sum + g.lessons.length, 0);
  const topMistakes = db
    .prepare(
      `SELECT correct_phrase as phrase, COUNT(*) as count FROM mistakes
       GROUP BY correct_phrase ORDER BY count DESC LIMIT 5`
    )
    .all();

  return {
    name: profile?.name ?? null,
    level: profile?.level ?? null,
    streak: computeCurrentStreak(),
    weekCount: weekCount(),
    lessonsCompleted,
    totalLessons,
    practiceMinutes: estimatePracticeMinutes(),
    topMistakes,
  };
});

app.get("/api/export", async (_request, reply) => {
  const data = {
    exportedAt: new Date().toISOString(),
    profile: db.prepare("SELECT * FROM profile WHERE id = 1").get(),
    lessonsCompleted: db.prepare("SELECT lesson_id, completed_at FROM lesson_progress").all(),
    mistakes: db.prepare("SELECT original_text, correct_phrase, created_at FROM mistakes").all(),
    activityLog: db.prepare("SELECT date FROM activity_log ORDER BY date").all(),
    streak: computeCurrentStreak(),
    practiceMinutes: estimatePracticeMinutes(),
  };
  reply.header("Content-Disposition", 'attachment; filename="papo-reto-progresso.json"');
  reply.type("application/json").send(data);
});

app.get("/api/mistakes/review", async () => ({
  mistakes: db
    .prepare(
      `SELECT correct_phrase as phrase, COUNT(*) as count, MAX(created_at) as lastSeen
       FROM mistakes GROUP BY correct_phrase ORDER BY count DESC, lastSeen DESC LIMIT 10`
    )
    .all(),
}));

function normalizeForCompare(s: string): string {
  return s.toLowerCase().replace(/[^a-z\s]/g, "").trim();
}

// Streaming NDJSON em vez de um JSON único: no CPU dessa máquina, a geração do Ollama
// pode levar até 90s (ver HISTORICO.md), e esperar o corpo inteiro deixava a tela
// parada esse tempo todo sem nenhum feedback. Cada linha é um evento:
//   {type:"mood", mood}              — enviado assim que o humor é calculado
//   {type:"chunk", text}             — pedaço de texto conforme o modelo gera
//   {type:"done", practicePhrase, streak} — metadados que só existem com a resposta completa
//   {type:"error", error}            — Ollama falhou (headers HTTP já foram enviados como 200,
//                                       então o erro vai dentro do stream, não como status code)
app.post<{ Body: { text: string } }>("/api/chat", async (request, reply) => {
  const { text } = request.body;

  const profile = db.prepare("SELECT * FROM profile WHERE id = 1").get() as Profile | undefined;
  if (!profile) {
    return reply.code(400).send({ error: "Complete o onboarding antes de conversar." });
  }

  db.prepare("INSERT INTO messages (author, text) VALUES (?, ?)").run("user", text);

  const rows = db
    .prepare("SELECT author, text FROM messages ORDER BY id DESC LIMIT ?")
    .all(HISTORY_LIMIT) as { author: "user" | "agent"; text: string }[];

  const history: ChatMessage[] = rows
    .reverse()
    .map((row) => ({ role: row.author === "user" ? "user" : "assistant", content: row.text }));

  const userMessageCount = history.filter((m) => m.role === "user").length;
  const mood = nextMood(profile.mode, userMessageCount);

  const stream = new PassThrough();
  reply.type("application/x-ndjson").send(stream);
  stream.write(JSON.stringify({ type: "mood", mood }) + "\n");

  let answer = "";
  try {
    answer = await streamAgent(history, profile.mode, mood, (delta) => {
      stream.write(JSON.stringify({ type: "chunk", text: delta }) + "\n");
    });
  } catch {
    stream.write(
      JSON.stringify({ type: "error", error: "O Ollama não respondeu. Ele está rodando (`ollama serve`)?" }) + "\n"
    );
    stream.end();
    return;
  }

  db.prepare("INSERT INTO messages (author, text) VALUES (?, ?)").run("agent", answer);

  const practicePhrase = extractPracticePhrase(answer);
  if (practicePhrase && normalizeForCompare(practicePhrase) !== normalizeForCompare(text)) {
    db.prepare("INSERT INTO mistakes (original_text, correct_phrase) VALUES (?, ?)").run(text, practicePhrase);
  }

  const streak = touchStreak();

  stream.write(JSON.stringify({ type: "done", practicePhrase, streak }) + "\n");
  stream.end();
});

app.post<{ Body: { text: string } }>("/api/speak", async (request, reply) => {
  try {
    const audio = await synthesizeSpeech(request.body.text);
    reply.type("audio/wav").send(audio);
  } catch {
    reply.code(503).send({ error: "O Piper não conseguiu gerar o áudio." });
  }
});

app.listen({ port: 3001 }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`Papo Reto backend rodando em ${address}`);
});
