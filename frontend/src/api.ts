// URL do backend num só lugar — antes estava duplicada em App.tsx e useSpeech.ts.
// VITE_API_URL pode ser definida num .env se o backend algum dia rodar em outra porta/host.
export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";
