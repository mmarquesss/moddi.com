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

export type SpeechLang = "pt" | "en";
export type SpeechSegment = { text: string; lang: SpeechLang };

export function useSpeech() {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Fase 10: cada chamada de speakSegments recebe um id novo — se uma resposta nova
  // chegar enquanto a fila anterior ainda está tocando, a fila antiga se vê "velha"
  // neste ref e para de agendar o próximo segmento, em vez de sobrepor as duas falas.
  const speechRunId = useRef(0);

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
  // Fase 10: lang escolhe a voz (pt_BR pra explicação, en_US pra frase de prática).
  async function synthesize(text: string, lang: SpeechLang): Promise<string | null> {
    if (!text.trim()) return null;
    try {
      const res = await fetch(`${API_URL}/api/speak`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, lang }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) return null;
      const blob = await res.blob();
      return URL.createObjectURL(blob);
    } catch {
      // Piper indisponível — silencioso, a conversa em texto continua funcionando.
      return null;
    }
  }

  function playUrl(url: string): Promise<void> {
    return new Promise((resolve) => {
      audioRef.current?.pause();
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => resolve();
      audio.onerror = () => resolve();
      audio.play();
    });
  }

  async function speak(text: string, lang: SpeechLang = "en") {
    speechRunId.current += 1;
    const url = await synthesize(text, lang);
    if (!url) return;
    await playUrl(url);
    URL.revokeObjectURL(url);
  }

  // Fase 10: toca a resposta inteira da professora (não só a frase de prática), um
  // segmento por vez, trocando de voz entre português e inglês conforme a ordem em
  // que aparecem na resposta.
  //
  // Bug real corrigido: antes, cada segmento só era sintetizado quando chegava sua vez
  // (depois do segmento anterior terminar de tocar) — como o Piper gasta ~1-2s pra
  // sintetizar um texto novo (não cacheado, já que a resposta do agente nunca é igual
  // à anterior), isso criava uma pausa real no meio da fala a cada troca de idioma,
  // que parecia "travar pra mudar de voz". Agora todos os segmentos são sintetizados
  // em paralelo antes de tocar o primeiro — a troca entre eles passa a ser só o tempo
  // de iniciar o próximo áudio já pronto, não o tempo de gerar ele.
  async function speakSegments(segments: SpeechSegment[]) {
    const runId = ++speechRunId.current;
    if (segments.length === 0) return;

    const urls = await Promise.all(segments.map((s) => synthesize(s.text, s.lang)));

    for (const url of urls) {
      if (speechRunId.current !== runId) {
        urls.forEach((u) => u && URL.revokeObjectURL(u));
        return; // uma fala mais nova já tomou a vez
      }
      if (!url) continue;
      await playUrl(url);
      URL.revokeObjectURL(url);
    }
  }

  return { supported, listening, error, listen, stopListening, speak, speakSegments };
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
