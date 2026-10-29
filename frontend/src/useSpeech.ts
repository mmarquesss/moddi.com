import { useEffect, useRef, useState } from "react";
import { API_URL } from "./api";

// Fase 04: Web Speech API nativa do navegador pra ouvir o aluno (só Chrome/Edge reconhecem
// fala em inglês de forma confiável). Upgrade futuro: faster-whisper se a precisão não bastar.
function getRecognition(): any {
  const SpeechRecognitionCtor =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SpeechRecognitionCtor) return null;
  const recognition = new SpeechRecognitionCtor();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  return recognition;
}

// Mensagens em português pros erros mais comuns do SpeechRecognition — por padrão o
// Chrome só expõe um código de erro (event.error) e falha em silêncio, o que faz o
// mic "parecer" quebrado quando na verdade é permissão negada ou falta de internet
// (o reconhecimento do Chrome roda na nuvem da Google, não é 100% local).
function describeSpeechError(code: string): string {
  switch (code) {
    case "not-allowed":
    case "permission-denied":
      return "🎤 Permissão de microfone negada — libere o microfone nas configurações do navegador.";
    case "no-speech":
      return "🎤 Não ouvi nada. Tenta de novo, falando logo após clicar.";
    case "network":
      return "🎤 Sem conexão — o reconhecimento de fala do navegador precisa de internet.";
    case "audio-capture":
      return "🎤 Nenhum microfone encontrado.";
    default:
      return "🎤 Não consegui ouvir. Tenta de novo.";
  }
}

export function useSpeech() {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const supported =
    typeof window !== "undefined" &&
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  // Garante que a sessão de reconhecimento é encerrada se o componente desmontar ou
  // trocar de aba no meio da escuta — senão o Chrome mantém a sessão "presa" e a
  // próxima tentativa de start() lança InvalidStateError (botão trava em "Ouvindo...").
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  function listen(onResult: (transcript: string) => void) {
    const recognition = getRecognition();
    if (!recognition) return;

    setError(null);

    recognition.onresult = (event: any) => {
      onResult(event.results[0][0].transcript);
    };
    recognition.onerror = (event: any) => {
      setListening(false);
      setError(describeSpeechError(event.error));
    };
    recognition.onend = () => setListening(false);

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setListening(true);
    } catch {
      // Sessão anterior ainda não tinha terminado de fechar (ex.: troca rápida de
      // aba) — sem isso o botão ficava travado em "Ouvindo..." pra sempre.
      setListening(false);
      setError("🎤 Ainda terminando a escuta anterior — espera um instante e tenta de novo.");
    }
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  // Fase 05: Piper (TTS neural local) no lugar da speechSynthesis do navegador — voz bem
  // menos robotizada. O backend sintetiza o WAV e a gente só toca o áudio recebido.
  async function speak(text: string) {
    if (!text.trim()) return;
    try {
      const res = await fetch(`${API_URL}/api/speak`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      audioRef.current?.pause();
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.play();
      audio.onended = () => URL.revokeObjectURL(url);
    } catch {
      // Piper indisponível — silencioso, a conversa em texto continua funcionando.
    }
  }

  return { supported, listening, error, listen, stopListening, speak };
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .trim();
}

export function scoreAttempt(target: string, attempt: string): number {
  const targetWords = normalize(target).split(/\s+/).filter(Boolean);
  const attemptWords = new Set(normalize(attempt).split(/\s+/).filter(Boolean));
  if (targetWords.length === 0) return 0;
  const matched = targetWords.filter((w) => attemptWords.has(w)).length;
  return matched / targetWords.length;
}

export function feedbackFor(score: number): string {
  if (score >= 0.85) return "✅ Perfeito!";
  if (score >= 0.5) return "⚠️ Quase lá — tenta de novo, bem devagar.";
  return "❌ Não bateu. Ouve de novo e repete.";
}
