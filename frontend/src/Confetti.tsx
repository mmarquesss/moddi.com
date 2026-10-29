const COLORS = ["#2e7d6b", "#c9892f", "#a6431b", "#4fb89e", "#e6c89c"];

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
