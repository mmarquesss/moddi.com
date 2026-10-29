import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const VOICE_MODEL = join(__dirname, "..", "voices", "en_US-amy-medium.onnx");

// As frases de prática se repetem bastante (starters da Trilha, frases já corrigidas
// na Revisão) — cachear o WAV por texto evita spawnar o Piper de novo pra algo que já
// foi sintetizado, o que é a maior parte do custo de /api/speak (processo + I/O).
const CACHE_DIR = join(__dirname, "..", ".tts-cache");

function cacheKey(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

// Fase 05: Piper (TTS neural local, grátis) no lugar da speechSynthesis do navegador —
// a voz nativa do browser soava robotizada demais pro pedido de "fala mais natural".
export async function synthesizeSpeech(text: string): Promise<Buffer> {
  await mkdir(CACHE_DIR, { recursive: true });
  const cachedFile = join(CACHE_DIR, `${cacheKey(text)}.wav`);

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
      const proc = spawn("piper", ["-m", VOICE_MODEL, "-f", outFile], {
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
