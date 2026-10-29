import { useEffect, useRef, useState } from "react";
import "./App.css";
import { feedbackFor, scoreAttempt, useSpeech } from "./useSpeech";
import Avatar from "./Avatar";
import Confetti from "./Confetti";
import { API_URL } from "./api";

type Mode = "normal" | "brava";
type MoodState = "calmo" | "atento" | "no_limite";
type Profile = { name: string; goal: string; level: string; mode: Mode };
type Message = { author: "user" | "agent"; text: string; practicePhrase?: string | null };
type QuizQuestion = { id: string; level: string; text: string; options: string[] };
type Lesson = {
  id: string;
  topic: string;
  objectives: string[];
  vocabulary: string[];
  starter: string;
  completed: boolean;
};
type LevelGroup = { level: string; title: string; lessons: Lesson[] };
type Streak = { current: number; weekCount: number };

export default function App() {
  const [profile, setProfile] = useState<Profile | null | "loading">("loading");
  const [tab, setTab] = useState<"chat" | "trilha" | "revisao" | "progresso">("chat");
  const [pendingStarter, setPendingStarter] = useState<string | null>(null);
  const [streak, setStreak] = useState<Streak>({ current: 0, weekCount: 0 });

  useEffect(() => {
    fetch(`${API_URL}/api/profile`)
      .then((r) => r.json())
      .then((data) => setProfile(data.profile));
  }, []);

  useEffect(() => {
    if (!profile || profile === "loading") return;
    fetch(`${API_URL}/api/streak`)
      .then((r) => r.json())
      .then(setStreak);
  }, [profile]);

  if (profile === "loading") return null;
  if (profile === null) return <Onboarding onDone={setProfile} />;

  function practice(phrase: string) {
    setPendingStarter(phrase);
    setTab("chat");
  }

  return (
    <div className="app">
      <nav className="tabs">
        <button className={tab === "chat" ? "active" : ""} onClick={() => setTab("chat")}>
          Chat
        </button>
        <button className={tab === "trilha" ? "active" : ""} onClick={() => setTab("trilha")}>
          Trilha
        </button>
        <button className={tab === "revisao" ? "active" : ""} onClick={() => setTab("revisao")}>
          Revisão
        </button>
        <button className={tab === "progresso" ? "active" : ""} onClick={() => setTab("progresso")}>
          Progresso
        </button>
        <span className="streak-badge" title="Dias seguidos praticando">
          🔥 {streak.current}
        </span>
      </nav>
      {tab === "chat" && (
        <Chat
          profile={profile}
          onProfileChange={setProfile}
          pendingStarter={pendingStarter}
          onStarterConsumed={() => setPendingStarter(null)}
          onStreakUpdate={setStreak}
        />
      )}
      {tab === "trilha" && <Trilha currentLevel={profile.level} onPractice={practice} />}
      {tab === "revisao" && <Revisao onPractice={practice} />}
      {tab === "progresso" && <Progresso />}
    </div>
  );
}

type Dashboard = {
  name: string | null;
  level: string | null;
  streak: number;
  weekCount: number;
  lessonsCompleted: number;
  totalLessons: number;
  practiceMinutes: number;
  topMistakes: { phrase: string; count: number }[];
};

function Progresso() {
  const [data, setData] = useState<Dashboard | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/dashboard`)
      .then((r) => r.json())
      .then(setData);
  }, []);

  async function exportProgress() {
    const res = await fetch(`${API_URL}/api/export`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "papo-reto-progresso.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!data) return null;

  return (
    <div className="dashboard">
      <div className="stat-grid">
        <div className="stat-card">
          <p className="stat-value">{data.level ?? "—"}</p>
          <p className="stat-label">nível atual</p>
        </div>
        <div className="stat-card">
          <p className="stat-value">🔥 {data.streak}</p>
          <p className="stat-label">dias seguidos</p>
        </div>
        <div className="stat-card">
          <p className="stat-value">{data.weekCount}/7</p>
          <p className="stat-label">dias essa semana</p>
        </div>
        <div className="stat-card">
          <p className="stat-value">{data.practiceMinutes}</p>
          <p className="stat-label">minutos praticados</p>
        </div>
        <div className="stat-card">
          <p className="stat-value">
            {data.lessonsCompleted}/{data.totalLessons}
          </p>
          <p className="stat-label">lições concluídas</p>
        </div>
      </div>

      <h3 className="dashboard-subtitle">Erros mais comuns</h3>
      {data.topMistakes.length === 0 ? (
        <p className="review-empty">Nenhum ainda.</p>
      ) : (
        <div className="review-list">
          {data.topMistakes.map((m) => (
            <div key={m.phrase} className="review-card">
              <div>
                <p className="review-phrase">"{m.phrase}"</p>
                <p className="review-count">{m.count}x corrigido</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <button className="export-btn" onClick={exportProgress}>
        ⬇ Exportar progresso
      </button>
    </div>
  );
}

function Revisao({ onPractice }: { onPractice: (phrase: string) => void }) {
  const [mistakes, setMistakes] = useState<{ phrase: string; count: number }[] | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/mistakes/review`)
      .then((r) => r.json())
      .then((data) => setMistakes(data.mistakes));
  }, []);

  if (!mistakes) return null;

  if (mistakes.length === 0) {
    return <p className="review-empty">Nenhum erro recorrente ainda — vai aparecer aqui conforme você praticar.</p>;
  }

  return (
    <div className="review-list">
      {mistakes.map((m) => (
        <div key={m.phrase} className="review-card">
          <div>
            <p className="review-phrase">"{m.phrase}"</p>
            <p className="review-count">{m.count}x corrigido</p>
          </div>
          <button onClick={() => onPractice(m.phrase)}>Praticar</button>
        </div>
      ))}
    </div>
  );
}

function Onboarding({ onDone }: { onDone: (p: Profile) => void }) {
  const [step, setStep] = useState<"info" | "quiz">("info");
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [mode, setMode] = useState<Mode>("normal");

  async function submitInfo() {
    await fetch(`${API_URL}/api/profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, goal, mode, level: "A1" }),
    });
    setStep("quiz");
  }

  if (step === "info") {
    return (
      <div className="onboarding">
        <h1>Papo Reto</h1>
        <p className="dek">Antes de começar, me conta um pouco sobre você.</p>

        <label>
          Seu nome
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Marlon" />
        </label>

        <label>
          Objetivo com o inglês
          <input
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="Ex: conversar em viagens"
          />
        </label>

        <fieldset className="mode-picker">
          <legend>Como o agente deve te tratar?</legend>
          <label className={mode === "normal" ? "picked" : ""}>
            <input type="radio" name="mode" checked={mode === "normal"} onChange={() => setMode("normal")} />
            <b>Normal</b> — paciente, comemora progresso
          </label>
          <label className={mode === "brava" ? "picked" : ""}>
            <input type="radio" name="mode" checked={mode === "brava"} onChange={() => setMode("brava")} />
            <b>Exigente</b> — direto, cobra repetição no erro
          </label>
        </fieldset>

        <button disabled={!name || !goal} onClick={submitInfo}>
          Continuar para o teste de nível
        </button>
      </div>
    );
  }

  return <PlacementQuiz onDone={(level) => onDone({ name, goal, mode, level })} />;
}

function PlacementQuiz({ onDone }: { onDone: (level: string) => void }) {
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch(`${API_URL}/api/placement-quiz`)
      .then((r) => r.json())
      .then((data) => setQuestions(data.questions));
  }, []);

  async function submit() {
    const res = await fetch(`${API_URL}/api/placement-quiz`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers }),
    });
    const data = await res.json();
    onDone(data.level);
  }

  if (!questions) return null;
  const allAnswered = questions.every((q) => answers[q.id]);

  return (
    <div className="onboarding">
      <h1>Teste de nível</h1>
      <p className="dek">Responda o que souber — chutar não ajuda, pular tudo bem.</p>

      {questions.map((q) => (
        <fieldset key={q.id} className="quiz-question">
          <legend>{q.text}</legend>
          {q.options.map((opt) => (
            <label key={opt} className={answers[q.id] === opt ? "picked" : ""}>
              <input
                type="radio"
                name={q.id}
                checked={answers[q.id] === opt}
                onChange={() => setAnswers((a) => ({ ...a, [q.id]: opt }))}
              />
              {opt}
            </label>
          ))}
        </fieldset>
      ))}

      <button disabled={!allAnswered} onClick={submit}>
        Ver meu nível
      </button>
    </div>
  );
}

function Trilha({
  currentLevel,
  onPractice,
}: {
  currentLevel: string;
  onPractice: (starter: string) => void;
}) {
  const [levels, setLevels] = useState<LevelGroup[] | null>(null);

  async function load() {
    const data = await fetch(`${API_URL}/api/curriculum`).then((r) => r.json());
    setLevels(data.levels);
  }

  useEffect(() => {
    load();
  }, []);

  async function complete(lessonId: string) {
    await fetch(`${API_URL}/api/lessons/${lessonId}/complete`, { method: "POST" });
    load();
  }

  if (!levels) return null;

  return (
    <div className="trilha">
      {levels.map((group) => (
        <section key={group.level} className={group.level === currentLevel ? "current-level" : ""}>
          <h2>
            {group.level} — {group.title}
            {group.level === currentLevel && <span className="tag">seu nível</span>}
          </h2>
          <div className="lessons">
            {group.lessons.map((lesson) => (
              <div key={lesson.id} className={`lesson-card ${lesson.completed ? "done" : ""}`}>
                <h3>{lesson.topic}</h3>
                <ul>
                  {lesson.objectives.map((o) => (
                    <li key={o}>{o}</li>
                  ))}
                </ul>
                <div className="vocab">
                  {lesson.vocabulary.map((v) => (
                    <span key={v} className="vocab-pill">
                      {v}
                    </span>
                  ))}
                </div>
                <div className="lesson-actions">
                  <button onClick={() => onPractice(lesson.starter)}>Praticar</button>
                  <button
                    className={lesson.completed ? "done-btn" : ""}
                    onClick={() => complete(lesson.id)}
                  >
                    {lesson.completed ? "✓ Concluída" : "Marcar como concluída"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function RepeatDrill({ phrase, onContinue }: { phrase: string; onContinue: () => void }) {
  const { supported, listening, error, listen, speak } = useSpeech();
  const [attempt, setAttempt] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  function repeat() {
    setFeedback(null);
    listen((transcript) => {
      setAttempt(transcript);
      setFeedback(feedbackFor(scoreAttempt(phrase, transcript)));
    });
  }

  return (
    <div className="drill">
      <p className="drill-label">Repita a frase em voz alta:</p>
      <p className="drill-phrase">"{phrase}"</p>
      <div className="drill-actions">
        <button type="button" onClick={() => speak(phrase)}>
          🔊 Ouvir
        </button>
        {supported && (
          <button type="button" onClick={repeat} disabled={listening}>
            {listening ? "🎙️ Ouvindo..." : "🎤 Repetir"}
          </button>
        )}
      </div>
      {!supported && <p className="drill-hint">Reconhecimento de voz não suportado neste navegador — use Chrome ou Edge.</p>}
      {error && <p className="mic-error">{error}</p>}
      {attempt && <p className="drill-attempt">Você disse: "{attempt}"</p>}
      {feedback && <p className="drill-feedback">{feedback}</p>}
      <button type="button" className="drill-continue" onClick={onContinue}>
        Continuar para o chat
      </button>
    </div>
  );
}

function Chat({
  profile,
  onProfileChange,
  pendingStarter,
  onStarterConsumed,
  onStreakUpdate,
}: {
  profile: Profile;
  onProfileChange: (p: Profile) => void;
  pendingStarter: string | null;
  onStarterConsumed: () => void;
  onStreakUpdate: (s: { current: number; weekCount: number }) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([
    { author: "agent", text: `Oi, ${profile.name}! Pronto pra praticar? Me conta o que você quiser.` },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [drillPhrase, setDrillPhrase] = useState<string | null>(null);
  const [voiceOn, setVoiceOn] = useState(true);
  const [mood, setMood] = useState<MoodState>("calmo");
  const [celebrating, setCelebrating] = useState(false);

  const { supported: speechSupported, listening, error: micError, listen, speak } = useSpeech();
  const lastSpoken = useRef(-1);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (pendingStarter) {
      setDrillPhrase(pendingStarter);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingStarter]);

  useEffect(() => {
    const lastIndex = messages.length - 1;
    const last = messages[lastIndex];
    // Só a frase de prática (inglês) é falada em voz alta — o resto da resposta
    // é texto de apoio em português, sem áudio (regra de idioma da Fase 05).
    if (voiceOn && last?.author === "agent" && last.practicePhrase && lastIndex > lastSpoken.current) {
      speak(last.practicePhrase);
      lastSpoken.current = lastIndex;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, voiceOn]);

  function finishDrill() {
    if (drillPhrase) {
      setMessages((m) => [...m, { author: "agent", text: drillPhrase }]);
    }
    setDrillPhrase(null);
    onStarterConsumed();
  }

  // O botão principal é o de falar — numa conversa de verdade você não "revisa o
  // texto antes de mandar", então aqui a fala já transcrita envia direto. Quem
  // prefere revisar antes continua podendo digitar e clicar Enviar normalmente.
  function recordInput() {
    listen((transcript) => {
      setInput(transcript);
      sendMessage(transcript);
    });
  }

  function updateLastAgentMessage(patch: Partial<Message>) {
    setMessages((m) => {
      const next = [...m];
      next[next.length - 1] = { ...next[next.length - 1], ...patch };
      return next;
    });
  }

  // Lê a resposta do /api/chat como NDJSON (um evento por linha) em vez de esperar o
  // JSON inteiro: no CPU dessa máquina o Ollama pode levar até 90s pra terminar uma
  // resposta (ver HISTORICO.md), e sem streaming a tela ficava parada esse tempo todo
  // sem nenhum feedback, parecendo travada.
  async function sendMessage(overrideText?: string) {
    const text = (overrideText ?? input).trim();
    if (!text || sending) return;

    setMessages((m) => [...m, { author: "user", text }]);
    setInput("");
    setSending(true);
    setMessages((m) => [...m, { author: "agent", text: "" }]);

    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(130_000),
      });
      if (!res.ok || !res.body) throw new Error("backend respondeu com erro");

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
          const event = JSON.parse(line);

          if (event.type === "mood") {
            setMood(event.mood);
          } else if (event.type === "chunk") {
            full += event.text;
            updateLastAgentMessage({ text: full });
          } else if (event.type === "error") {
            updateLastAgentMessage({ text: event.error });
          } else if (event.type === "done") {
            updateLastAgentMessage({ practicePhrase: event.practicePhrase });
            if (event.streak) {
              onStreakUpdate(event.streak);
              if (event.streak.isNewDay) {
                setCelebrating(true);
                setTimeout(() => setCelebrating(false), 2000);
              }
            }
          }
        }
      }
    } catch {
      updateLastAgentMessage({ text: "⚠️ Não consegui falar com o backend." });
    } finally {
      setSending(false);
    }
  }

  async function changeMode(mode: Mode) {
    const updated = { ...profile, mode };
    onProfileChange(updated);
    await fetch(`${API_URL}/api/profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    });
  }

  return (
    <div className="chat">
      {celebrating && <Confetti />}
      <div className="chat-header">
        <h1>Papo Reto</h1>
        <div className="header-actions">
          <button className="settings-btn" onClick={() => setVoiceOn((v) => !v)} title="Falar respostas em voz">
            {voiceOn ? "🔊" : "🔇"}
          </button>
          <button className="settings-btn" onClick={() => setShowSettings((s) => !s)}>
            ⚙️ {profile.mode === "normal" ? "Normal" : "Exigente"}
          </button>
        </div>
      </div>

      {showSettings && (
        <div className="settings-panel">
          <button className={profile.mode === "normal" ? "picked" : ""} onClick={() => changeMode("normal")}>
            Normal
          </button>
          <button className={profile.mode === "brava" ? "picked" : ""} onClick={() => changeMode("brava")}>
            Exigente
          </button>
        </div>
      )}

      <div className="stage">
        <Avatar mood={mood} />
        {!drillPhrase && speechSupported && (
          <button
            type="button"
            className={`talk-btn ${listening ? "listening" : ""}`}
            onClick={recordInput}
            disabled={listening}
          >
            {listening ? "🎙️ Ouvindo..." : "🎤 Falar"}
          </button>
        )}
        {!drillPhrase && !speechSupported && (
          <p className="drill-hint">Reconhecimento de voz não suportado — use Chrome ou Edge.</p>
        )}
        {!drillPhrase && micError && <p className="mic-error">{micError}</p>}
      </div>

      {drillPhrase ? (
        <RepeatDrill phrase={drillPhrase} onContinue={finishDrill} />
      ) : (
        <>
          <div className="messages compact">
            {messages.map((m, i) =>
              m.author === "agent" && m.text === "" && sending && i === messages.length - 1 ? (
                <div key={i} className="bubble agent typing">
                  <span />
                  <span />
                  <span />
                </div>
              ) : (
                <div key={i} className={`bubble ${m.author}`}>
                  {m.text}
                </div>
              )
            )}
            <div ref={messagesEndRef} />
          </div>
          <form
            className="composer"
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ou digite aqui, se preferir..."
            />
            <button type="submit" disabled={sending}>
              Enviar
            </button>
          </form>
        </>
      )}
    </div>
  );
}
