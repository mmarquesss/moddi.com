const OLLAMA_URL = "http://localhost:11434/api/chat";
// Fase 12: troquei de llama3.1:8b pra qwen2.5:3b-instruct. Nesta máquina (MacBook Air
// M1, 8GB de RAM total), o 8B em Q4 já ocupa 4.9GB só de peso — pressão de memória
// severa que explicava boa parte da lentidão (até 90s, Fase 02/08). Medido nesta fase:
// um modelo de 3B (~2GB) responde em menos de 1s já carregado, contra minutos do 8B
// sob pressão de memória.
//
// Testei dois candidatos de 3B (llama3.2:3b e qwen2.5:3b-instruct) com frases de erro
// fora do few-shot do prompt ("Yesterday I go to the beach", "I am agree with you"):
// o llama3.2:3b não pegou nenhuma das duas, o qwen2.5:3b-instruct pegou uma. Nenhum dos
// dois é perfeito — ficou registrado como risco conhecido, não resolvido (ver HISTORICO.md
// Fase 12): ao só corrigir quando o modelo "percebe" um erro de verdade (mudança desta
// mesma fase, pra soar menos como um exercício forçado), um erro real pode passar batido
// às vezes, o que o prompt antigo evitava à força custando naturalidade.
const MODEL = "qwen2.5:3b-instruct";

export type Mode = "normal" | "brava";
export type MoodState = "calmo" | "atento" | "no_limite";
// Fase 11: motor de conversa — "ollama" é o padrão 100% local; "gemini" usa a própria
// chave de API do usuário (Google AI Studio), mais rápido e mais disciplinado nas aspas.
export type Engine = "ollama" | "gemini";

// Regra de idioma definida em 2026-10-28: o agente conversa, explica e corrige em
// português — só a frase que o aluno deve praticar fica em inglês, sempre entre aspas.
//
// Fase 10: cada par de aspas vira uma troca de voz na fala (PT <-> EN) — "Exactly ONCE"
// reduz a troca de voz a no máximo uma por resposta, quando há aspas.
//
// Fase 12: até aqui o prompt exigia uma frase entre aspas em TODA resposta, mesmo sem
// nenhum erro do aluno — isso fazia a conversa parecer um exercício de repetição forçado
// em vez de um bate-papo (confirmado nos testes: toda resposta tinha uma frase pra
// repetir, mesmo em "oi, tudo bem?"). Agora as aspas só aparecem quando há uma correção
// de verdade. Também: variar a abertura (os testes mostraram "Não acredito! Você fez o
// mesmo erro novamente!" repetindo quase sempre) e respostas mais curtas — mais parecido
// com uma pessoa conversando, e de bônus menos texto pra gerar e sintetizar em voz.
const BASE_PROMPT = `You are Oddi, an English conversation coach for a Brazilian learner — you're having a
casual chat, not running a drill. Write your replies in Brazilian Portuguese, in 1-2 short sentences, like a
real chat message, not a lecture.

Only use English, in double quotes, when the learner's last message actually has a mistake to correct — the
quoted sentence is the one correct form you want them to repeat. If there is NO mistake, reply naturally in
Portuguese with no English and no quotes at all; just continue the conversation.

When there IS a mistake, use double quotes EXACTLY ONCE, around the one correct English sentence — that is
the ONLY English text allowed, and it must appear only that one time. Never quote the wrong form, a
comparison, or a Portuguese word — describe the mistake in plain Portuguese words instead (e.g. "você usou
o verbo no tempo errado").

Vary how you react to mistakes — don't open every correction the same way. Mix it up: sometimes matter-of-
fact, sometimes playful, sometimes just a quick nudge; real people don't repeat the exact same line every time.

Example with a mistake — learner: "I has two cats" -> you: Quase! É "have", não "has", com "I". Diga "I have two cats".
Example with no mistake — learner: "Hi, how are you?" -> you: Tudo bem! E você, como tá sendo o seu dia?

Never write a reply entirely in English, and never use quotes more than once in the same reply.`;

const MODE_PROMPT: Record<Mode, string> = {
  normal: `Tone (in Portuguese): warm and patient. When there's a mistake, acknowledge what the learner
meant, give the quoted correction, and encourage them to try again. Never sound annoyed or ironic — and
when there's no mistake, just chat normally, celebrate small wins, don't invent a correction.`,
  brava: `Tone (in Portuguese): blunt and impatient with repeated mistakes — you can be sarcastic about the
mistake itself. NEVER insult the person, their intelligence, or their identity — the harshness is always
about the sentence, not the speaker. When there IS a mistake, end by giving the quoted correction and
demanding they repeat it. When there's no mistake, just respond normally — don't invent a correction to
stay in character.`,
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
// geração inteira pode levar nessa máquina — streamAgent repassa cada pedaço pro
// chamador via onChunk assim que chega, em vez de esperar o fim.
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
      // Fase 12: por padrão o Ollama descarrega o modelo da memória depois de alguns
      // minutos sem uso (confirmado com `ollama ps` vazio nesta máquina) — a próxima
      // mensagem depois de uma pausa pagava o carregamento inteiro do modelo de novo
      // antes de começar a gerar. keep_alive mantém ele carregado por mais tempo entre
      // as mensagens espaçadas de uma conversa real.
      keep_alive: "15m",
      // num_predict: cap no tamanho da resposta — uma correção + frase de prática não
      // precisa de um parágrafo, e respostas mais longas custam tempo de geração E de
      // TTS depois.
      options: { num_predict: 220 },
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

// Fase 11: mesmo contrato de streamAgent (history, mode, mood, onChunk -> texto completo),
// só troca o motor — chama a Gemini API com a chave do próprio usuário em vez do Ollama
// local. Reaproveita os mesmos BASE_PROMPT/MODE_PROMPT/MOOD_PROMPT como system_instruction.
// "gemini-flash-latest" é um alias que a própria Gemini mantém apontando pro Flash
// vigente — usar um nome de versão fixo (ex. "gemini-2.0-flash") quebra quando o
// Google descontinua esse modelo (foi exatamente o que aconteceu: deu 404 nos testes
// desta fase, com a API recomendando atualizar pro modelo "mais novo" do momento).
const GEMINI_MODEL = "gemini-flash-latest";
const GEMINI_TIMEOUT_MS = 30_000;

export async function streamAgentGemini(
  history: ChatMessage[],
  mode: Mode,
  mood: MoodState,
  apiKey: string,
  onChunk: (delta: string) => void
): Promise<string> {
  const systemPrompt = [BASE_PROMPT, MODE_PROMPT[mode], MOOD_PROMPT[mood]].join("\n\n");

  // Gemini usa role "model" em vez de "assistant" (formato do Ollama) — sem mensagens
  // de sistema na lista de contents, já que o system_instruction vai num campo separado.
  const contents = history
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse&key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents,
      // thinkingBudget 0: corrigir gramática e responder como professora não precisa de
      // raciocínio em várias etapas — sem isso, o modelo gastava centenas de tokens de
      // "pensamento" interno (confirmado num teste manual) antes de começar a responder,
      // o que só atrasa a primeira palavra sem melhorar a qualidade pra esse uso.
      generationConfig: { thinkingConfig: { thinkingBudget: 0 } },
    }),
    signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
  });

  if (!res.ok || !res.body) {
    throw new Error(`Gemini respondeu ${res.status}`);
  }

  // Resposta em SSE (alt=sse): cada evento é uma linha "data: {...}" com um pedaço do
  // texto em candidates[0].content.parts[0].text — mesma ideia do NDJSON do Ollama,
  // formato diferente.
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
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice("data: ".length).trim();
      if (!payload) continue;

      const parsed = JSON.parse(payload) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const delta = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
      if (delta) {
        full += delta;
        onChunk(delta);
      }
    }
  }

  return full;
}
