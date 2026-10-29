import Fastify from "fastify";
import cors from "@fastify/cors";
import { PassThrough } from "node:stream";
import { db } from "./db.js";
import { streamAgent, streamAgentGemini, nextMood, type ChatMessage, type Mode, type Engine } from "./agent.js";
import { curriculum, quiz, scoreQuiz } from "./content.js";
import { synthesizeSpeech, extractPracticePhrase, splitSpeechSegments, type SpeechLang } from "./tts.js";
import { touchStreak, computeCurrentStreak, weekCount } from "./streak.js";
import { estimatePracticeMinutes } from "./stats.js";

const app = Fastify();
await app.register(cors, { origin: true });

// Fase 12: era 20 — cada mensagem extra no histórico é processamento de prompt antes
// do modelo começar a gerar qualquer coisa. 10 (5 trocas) ainda dá contexto de sobra
// pra uma conversa de correção de inglês, que não depende de memória de longo prazo.
const HISTORY_LIMIT = 10;

type Profile = {
  id: 1;
  name: string;
  goal: string;
  level: string;
  mode: Mode;
  engine: Engine;
  gemini_api_key: string | null;
};

app.get("/api/health", async () => ({ ok: true }));

// Fase 11: a chave do Gemini nunca sai inteira do backend — o front só recebe
// hasGeminiKey (booleano) pra saber se já tem uma configurada.
app.get("/api/profile", async () => {
  const profile = db.prepare("SELECT * FROM profile WHERE id = 1").get() as Profile | undefined;
  if (!profile) return { profile: null };
  const { gemini_api_key, ...rest } = profile;
  return { profile: { ...rest, hasGeminiKey: !!gemini_api_key } };
});

app.post<{ Body: Omit<Profile, "id" | "gemini_api_key"> }>("/api/profile", async (request, reply) => {
  const { name, goal, level, mode } = request.body;
  const engine: Engine = request.body.engine ?? "ollama";

  if (engine === "gemini") {
    const existing = db.prepare("SELECT gemini_api_key FROM profile WHERE id = 1").get() as
      | { gemini_api_key: string | null }
      | undefined;
    if (!existing?.gemini_api_key) {
      return reply.code(400).send({ error: "Configure uma chave Gemini antes de escolher esse motor." });
    }
  }

  db.prepare(
    `INSERT INTO profile (id, name, goal, level, mode, engine) VALUES (1, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name = ?, goal = ?, level = ?, mode = ?, engine = ?`
  ).run(name, goal, level, mode, engine, name, goal, level, mode, engine);
  return { ok: true };
});

// Fase 11: endpoint próprio pra chave — evita o problema de mascarar o valor no GET e
// acidentalmente sobrescrever a chave real com o valor mascarado num POST seguinte.
app.post<{ Body: { apiKey: string } }>("/api/gemini-key", async (request, reply) => {
  const profile = db.prepare("SELECT id FROM profile WHERE id = 1").get();
  if (!profile) {
    return reply.code(400).send({ error: "Complete o onboarding antes de configurar a chave." });
  }
  const apiKey = request.body.apiKey.trim() || null;
  db.prepare("UPDATE profile SET gemini_api_key = ? WHERE id = 1").run(apiKey);
  return { ok: true, hasGeminiKey: !!apiKey };
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
//   {type:"engine-fallback", reason} — Gemini falhou nessa requisição, caiu pro Ollama local
//   {type:"done", practicePhrase, segments, streak} — metadados da resposta completa
//   {type:"error", error}            — nenhum motor respondeu (headers HTTP já foram
//                                       enviados como 200, então o erro vai no stream)
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

  const onChunk = (delta: string) => stream.write(JSON.stringify({ type: "chunk", text: delta }) + "\n");

  let answer = "";
  try {
    if (profile.engine === "gemini" && profile.gemini_api_key) {
      try {
        answer = await streamAgentGemini(history, profile.mode, mood, profile.gemini_api_key, onChunk);
      } catch {
        // Fase 11: chave inválida, cota excedida ou sem internet — cai pro Ollama local
        // na mesma requisição em vez de simplesmente falhar, preservando a promessa de
        // "funciona local" mesmo com o motor cloud configurado.
        //
        // Limitação conhecida: se o Gemini já tiver mandado algum pedaço de texto antes
        // de falhar no meio do stream, esses pedaços já chegaram no front — o fallback
        // começa a resposta do Ollama "colada" neles, podendo ficar com um corte visível.
        // Não tratamos esse caso ainda; na prática a maioria das falhas (chave inválida,
        // cota, rede) acontece antes do primeiro chunk.
        stream.write(
          JSON.stringify({ type: "engine-fallback", reason: "Gemini não respondeu — usando o motor local." }) + "\n"
        );
        answer = await streamAgent(history, profile.mode, mood, onChunk);
      }
    } else {
      answer = await streamAgent(history, profile.mode, mood, onChunk);
    }
  } catch {
    stream.write(
      JSON.stringify({ type: "error", error: "Nenhum motor respondeu. O Ollama está rodando (`ollama serve`)?" }) +
        "\n"
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

  // Fase 10: segments ordena a resposta inteira em PT/EN (não só a frase de prática)
  // pro front tocar a professora falando tudo, trocando de voz entre os trechos.
  const segments = splitSpeechSegments(answer);

  stream.write(JSON.stringify({ type: "done", practicePhrase, segments, streak }) + "\n");
  stream.end();
});

app.post<{ Body: { text: string; lang?: SpeechLang } }>("/api/speak", async (request, reply) => {
  try {
    const audio = await synthesizeSpeech(request.body.text, request.body.lang ?? "pt");
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
