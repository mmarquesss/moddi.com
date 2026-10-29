import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export type SpeechLang = "pt" | "en";

// Fase 10: a professora passou a falar em português além da frase de prática em
// inglês — Piper é um modelo por idioma, então cada lang tem sua própria voz.
const VOICE_MODELS: Record<SpeechLang, string> = {
  en: join(__dirname, "..", "voices", "en_US-amy-medium.onnx"),
  pt: join(__dirname, "..", "voices", "pt_BR-faber-medium.onnx"),
};

// As frases de prática se repetem bastante (starters da Trilha, frases já corrigidas
// na Revisão) — cachear o WAV por texto evita spawnar o Piper de novo pra algo que já
// foi sintetizado, o que é a maior parte do custo de /api/speak (processo + I/O).
const CACHE_DIR = join(__dirname, "..", ".tts-cache");

function cacheKey(text: string, lang: SpeechLang): string {
  return createHash("sha256").update(`${lang}:${text}`).digest("hex");
}

// Fase 05: Piper (TTS neural local, grátis) no lugar da speechSynthesis do navegador —
// a voz nativa do browser soava robotizada demais pro pedido de "fala mais natural".
export async function synthesizeSpeech(text: string, lang: SpeechLang = "pt"): Promise<Buffer> {
  await mkdir(CACHE_DIR, { recursive: true });
  const cachedFile = join(CACHE_DIR, `${cacheKey(text, lang)}.wav`);

  try {
    return await readFile(cachedFile);
  } catch {
    // cache miss — segue pro Piper
  }

  const dir = await mkdtemp(join(tmpdir(), "papo-reto-tts-"));
  const outFile = join(dir, "out.wav");

  try {
    await new Promise<void>((resolve, reject) => {
      // signal mata o processo se o piper travar — sem isso, um piper preso deixava
      // a requisição de /api/speak pendurada pra sempre, sem nunca dar erro nem timeout.
      const proc = spawn("piper", ["-m", VOICE_MODELS[lang], "-f", outFile], {
        signal: AbortSignal.timeout(20_000),
      });
      proc.stdin.write(text);
      proc.stdin.end();
      proc.on("error", reject);
      proc.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`piper saiu com código ${code}`))));
    });

    const audio = await readFile(outFile);
    await writeFile(cachedFile, audio).catch(() => {
      // cache é um ganho, não um requisito — se a escrita falhar, a resposta já foi gerada
    });
    return audio;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// O agente fala em português, só a frase de prática em inglês fica entre aspas
// (regra definida em 2026-10-28). Só essa frase vale a pena sintetizar com a voz
// em inglês — o resto é texto de apoio em português, sem áudio.
//
// Modelo local às vezes também bota um trecho em português entre aspas (risco 01
// do plano: persona menos consistente num modelo pequeno) — por isso filtramos
// qualquer aspas com acento/caractere do português antes de escolher a última
// que sobrar, já que o prompt pede pra frase em inglês vir sempre por último.
const PORTUGUESE_CHARS = /[áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]/;

export function extractPracticePhrase(text: string): string | null {
  // {1,160}, não {2,...}: uma aspas curta tipo "I" (1 caractere) precisa casar como seu
  // próprio par — senão o regex pula ela e desalinha o pareamento de todas as aspas seguintes.
  const matches = [...text.matchAll(/["“]([^"”]{1,160})["”]/g)]
    .map((m) => m[1].trim())
    .filter((phrase) => phrase.length > 0 && !PORTUGUESE_CHARS.test(phrase));

  return matches.length > 0 ? matches[matches.length - 1] : null;
}

export type SpeechSegment = { text: string; lang: SpeechLang };

// Remove aspas residuais de um trecho em PT (ex.: o modelo citando a forma errada
// antes da frase-alvo) sem cortar o texto em segmento separado — essas palavras em
// inglês continuam lidas junto do resto, com a voz em português mesmo.
function stripQuotes(chunk: string): string {
  return chunk.replace(/["“”]/g, "");
}

// Fase 10: a professora passa a falar a resposta inteira, não só a frase de prática.
//
// Bug real evitado aqui: o prompt pede pra citar em inglês só a frase-alvo, uma vez,
// no final — mas o modelo local (Llama 3.1 8B) nem sempre obedece, e às vezes cita a
// forma errada E a certa E repete a certa no fim, o que faria a fala trocar de voz
// PT/EN 4-5 vezes numa resposta só (ver HISTORICO.md). Em vez de confiar no modelo,
// só a ÚLTIMA aspas válida (mesma escolha de extractPracticePhrase) vira um segmento
// em inglês — qualquer aspas anterior é achatada de volta no texto em português ao
// redor. Isso garante no máximo UMA troca de voz por resposta, não importa quantas
// vezes o modelo tenha citado algo em inglês.
export function splitSpeechSegments(text: string): SpeechSegment[] {
  const matches = [...text.matchAll(/["“]([^"”]{1,160})["”]/g)].filter(
    (m) => m[1].trim().length > 0 && !PORTUGUESE_CHARS.test(m[1].trim())
  );
  const target = matches[matches.length - 1];

  if (!target || target.index === undefined) {
    const trimmed = stripQuotes(text).trim();
    return trimmed ? [{ text: trimmed, lang: "pt" }] : [];
  }

  const before = stripQuotes(text.slice(0, target.index)).trim();
  const phrase = target[1].trim();
  const after = stripQuotes(text.slice(target.index + target[0].length)).trim();

  const segments: SpeechSegment[] = [];
  if (before) segments.push({ text: before, lang: "pt" });
  segments.push({ text: phrase, lang: "en" });
  if (after) segments.push({ text: after, lang: "pt" });
  return segments;
}
