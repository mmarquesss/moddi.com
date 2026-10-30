type MoodState = "calmo" | "atento" | "no_limite";

// Fase 05: avatar minimalista (só olhos e boca) que reage ao `mood` da sessão —
// o mesmo calmo/atento/no_limite que o backend já calcula desde a Fase 02.
// Fase 14: cores ajustadas pra ler bem no fundo escuro (antes eram tons escuros
// pensados pra fundo claro) — mesma lógica de humor, paleta neon nova.
const EXPRESSIONS: Record<MoodState, { eyeRy: number; eyeTilt: number; mouth: string; color: string }> = {
  calmo: { eyeRy: 11, eyeTilt: 0, mouth: "M 60,96 Q 100,114 140,96", color: "#4fd6b5" },
  atento: { eyeRy: 6, eyeTilt: 8, mouth: "M 62,100 L 138,100", color: "#ffb74d" },
  no_limite: { eyeRy: 4, eyeTilt: 18, mouth: "M 62,106 Q 100,90 138,106", color: "#ff5c5c" },
};

export default function Avatar({ mood }: { mood: MoodState }) {
  const e = EXPRESSIONS[mood];

  return (
    <div className={`avatar-float ${mood === "no_limite" ? "avatar-jitter" : ""}`}>
      <svg viewBox="0 0 200 160" width="150" height="120" aria-hidden="true">
        <g stroke={e.color} strokeWidth="6" strokeLinecap="round" fill="none">
          <g transform={`rotate(${-e.eyeTilt} 70 60)`}>
            <ellipse cx="70" cy="60" rx="11" ry={e.eyeRy} />
          </g>
          <g transform={`rotate(${e.eyeTilt} 130 60)`}>
            <ellipse cx="130" cy="60" rx="11" ry={e.eyeRy} />
          </g>
          <path d={e.mouth} />
        </g>
      </svg>
    </div>
  );
}
