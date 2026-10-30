// Fase 14: paleta neon do redesign (indigo, emerald, amber) em vez dos tons do
// tema claro anterior.
const COLORS = ["#5c6bc0", "#00c853", "#ffb74d", "#e0e0e0", "#8e9cde"];

export default function Confetti() {
  const pieces = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="confetti">
      {pieces.map((i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            left: `${Math.random() * 100}%`,
            background: COLORS[i % COLORS.length],
            animationDelay: `${Math.random() * 0.3}s`,
            animationDuration: `${1.2 + Math.random() * 0.8}s`,
          }}
        />
      ))}
    </div>
  );
}
