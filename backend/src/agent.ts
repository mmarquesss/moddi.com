const OLLAMA_URL = "http://localhost:11434/api/chat";
const MODEL = "llama3.1:8b";

export type Mode = "normal" | "brava";
export type MoodState = "calmo" | "atento" | "no_limite";

// Regra de idioma definida em 2026-10-28: o agente conversa, explica e corrige em
// português — só a frase que o aluno deve praticar fica em inglês, sempre entre aspas.
const BASE_PROMPT = `You are Oddi, an English conversation coach for a Brazilian learner.
Write your replies in Brazilian Portuguese: explanations, questions, comments, and corrections — all in Portuguese.
The ONLY English text allowed in your reply is the exact sentence you want the learner to say or repeat,
and it must always be wrapped in double quotes, for example: diga "I went to the gym yesterday".
Double quotes are reserved ONLY for that English target sentence — never put Portuguese words inside
quotation marks, and never wrap the name of the mistake or any other text in quotes.
Never write a reply entirely in English. When the learner makes a grammar or vocabulary mistake,
name the mistake in Portuguese (no quotes) and give the correct English sentence in quotes.`;

const MODE_PROMPT: Record<Mode, string> = {
  normal: `Tone (in Portuguese): warm and patient. Acknowledge what the learner meant, give the correct
English sentence in quotes, and encourage them to try again. Never sound annoyed or ironic. Celebrate small wins.`,
  brava: `Tone (in Portuguese): blunt and impatient with repeated mistakes — you can be sarcastic about the
mistake itself. NEVER insult the person, their intelligence, or their identity — the harshness is always
about the sentence, not the speaker. Always end by giving the correct English sentence in quotes and
demanding they repeat it.`,
};

// Fase 02: calmo/atento/no_limite aproxima a "máquina de humor" do plano por uma contagem simples
// de mensagens na sessão (não por tipo de erro ainda — isso fica pra quando tivermos classificação
// de erro estruturada). No modo normal o estado nunca passa de "atento".
const MOOD_PROMPT: Record<MoodState, string> = {
  calmo: "Current mood: calm. This is early in the conversation.",
  atento: "Current mood: a bit impatient — this isn't the first mistake in this session.",
  no_limite:
    "Current mood: fed up — several mistakes in a row. Be noticeably sterner than usual, but still never insult the person.",
};

export function nextMood(mode: Mode, messageCount: number): MoodState {
  const raw: MoodState = messageCount >= 5 ? "no_limite" : messageCount >= 3 ? "atento" : "calmo";
  if (mode === "normal" && raw === "no_limite") return "atento";
  return raw;
}

export type ChatRole = "user" | "assistant" | "system";
export type ChatMessage = { role: ChatRole; content: string };

// Resposta do Ollama vira texto pouco a pouco em vez de só depois dos ~90s que a
// geração inteira pode levar nessa máquina (CPU, sem GPU) — streamAgent repassa cada
// pedaço pro chamador via onChunk assim que chega, em vez de esperar o fim.
const OLLAMA_TIMEOUT_MS = 120_000;

export async function streamAgent(
  history: ChatMessage[],
  mode: Mode,
  mood: MoodState,
  onChunk: (delta: string) => void
): Promise<string> {
  const systemPrompt = [BASE_PROMPT, MODE_PROMPT[mode], MOOD_PROMPT[mood]].join("\n\n");

  const res = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "system", content: systemPrompt }, ...history],
      stream: true,
    }),
    signal: AbortSignal.timeout(OLLAMA_TIMEOUT_MS),
  });

  if (!res.ok || !res.body) {
    throw new Error(`Ollama respondeu ${res.status}`);
  }

  // Ollama em modo stream devolve um JSON por linha (NDJSON), não SSE — cada linha
  // tem um pedaço em message.content até a linha final com done:true.
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;
      const parsed = JSON.parse(line) as { message?: { content: string } };
      const delta = parsed.message?.content;
      if (delta) {
        full += delta;
        onChunk(delta);
      }
    }
  }

  return full;
}
