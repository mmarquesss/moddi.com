# Papo Reto

App local de conversação em inglês, com um agente de IA rodando 100% na sua máquina
(sem custo por uso). Você conversa em inglês (por voz ou texto), o agente responde e
corrige em português, e só a frase que você precisa praticar fica em inglês.

Histórico completo de decisões, bugs encontrados e testes de cada fase: [HISTORICO.md](./HISTORICO.md).

## Stack

- **Frontend:** React + TypeScript + Vite
- **Backend:** Fastify + TypeScript, SQLite (`better-sqlite3`)
- **Agente conversacional:** [Ollama](https://ollama.com) rodando `llama3.1:8b` localmente
- **Voz:** reconhecimento de fala nativo do navegador (Chrome/Edge) + síntese de voz com [Piper](https://github.com/rhasspy/piper) (TTS neural local)

## Pré-requisitos

1. **Node.js** 18+
2. **Ollama** instalado e com o modelo baixado:
   ```bash
   brew install ollama
   brew services start ollama
   ollama pull llama3.1:8b
   ```
3. **Piper** (TTS) e a voz usada pelo app:
   ```bash
   pip3 install piper-tts
   ```
   Baixe a voz `en_US-amy-medium` ([vozes disponíveis aqui](https://github.com/rhasspy/piper/blob/master/VOICES.md)) e coloque os dois arquivos (`.onnx` e `.onnx.json`) em `backend/voices/`.

## Rodando o projeto

Mais simples — o atalho confere se tudo está de pé, builda o frontend e abre o navegador:

```bash
./start.command
```

Manual:

```bash
cd backend && npm install && npm run dev     # http://localhost:3001

cd frontend && npm install && npm run build && npx vite preview --port 5173
```

## Estrutura

```
backend/   API (Fastify), agente (Ollama), TTS (Piper), SQLite, currículo
frontend/  App React — chat, trilha de lições, voz, avatar, dashboard
```
