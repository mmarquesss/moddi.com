# Histórico do projeto — Papo Reto

App local de conversação em inglês, inspirado no Oddi. Plano completo:
https://claude.ai/code/artifact/1590f507-9d03-43ad-8104-d291880fda65

## Decisões

| Data | Decisão | Motivo |
|---|---|---|
| 2026-10-27 | Agente conversacional roda em **Ollama local** (Llama 3.1 8B), não API Claude | Evitar custo por uso — a API Claude é paga e separada da assinatura do Claude Code |
| 2026-10-27 | Stack: React+Vite+TS (front), Fastify+TS (back), SQLite | Simplicidade de setup local, uma linguagem só (TypeScript) nas duas pontas |

## Progresso por fase

| Fase | Status | Resumo |
|---|---|---|
| 00 — Fundação | ✅ Concluída | Scaffold do front e back, SQLite, chat mock validado |
| 01 — Agente conversacional | ✅ Concluída | Ollama real plugado, correções em contexto, histórico multi-turn |
| 02 — Dois modos + onboarding | ✅ Concluída | Onboarding, perfil persistido, estado de humor calmo/atento/no_limite |
| 03 — Currículo e nível | ✅ Concluída | Quiz de posicionamento, trilha A1–C1, progresso de lições persistido |
| 04 — Voz | ✅ Concluída | STT/TTS via Web Speech API, exercício de repetição de frase |
| 05 — Avatar e naturalidade | ✅ Concluída | Avatar minimalista reagindo ao mood, Piper TTS, prompt bilíngue PT/EN |
| 06 — Gamificação e hábito | ✅ Concluída | Streak diário, revisão de erros recorrentes, confete |
| 07 — Polimento e PWA local | ✅ Concluída | PWA instalável, dashboard pessoal, exportar progresso, atalho no Desktop |
| 08 — Correção e otimização | ✅ Concluída | Bug real do microfone corrigido, streaming do chat, cache de TTS, build de produção |
| 09 — Redesign visual e voz de verdade | ✅ Concluída | Frontend redesenhado (foco em conversação), causa raiz do mic sem captar (dispositivo errado no Chrome), fala manda direto |
| 10 — Conversa 100% em áudio | 🟡 Em andamento | Voz PT-BR + resposta inteira falada por segmentos já funcionando; falta reduzir a latência (falar durante o streaming) |
| 11 — Motor Gemini (chave do próprio usuário) | 🟡 Em andamento | Chave + troca de motor + fallback automático implementados e testados via API; falta testar com uma chave Gemini real no navegador |
| 12 — Otimizar o motor Ollama (velocidade + naturalidade) | ✅ Concluída | De até 90s pra 0.76-1.66s por resposta; aspas só quando há erro de verdade (risco: pode deixar passar erro às vezes) |
| 13 — Acessibilidade (ARIA) e indicador de "falando" | ✅ Concluída | `role="log"`/`role="status"` no Chat, erros como `role="alert"`, estado visual "falando" que faltava na UX de voz |
| 14 — Redesign visual "neon noturno" | ✅ Concluída | Tema escuro (indigo/emerald sobre midnight blue), bolhas com glow, cartão de correção em destaque, waveform decorativo no mic |

## Log

### 2026-10-27 — Fase 00 concluída

- Instalado Ollama via Homebrew (`brew install ollama`), serviço rodando em background (`brew services start ollama`).
- Baixado o modelo `llama3.1:8b` (4.9 GB) — confirmado respondendo via `POST /api/generate`.
- Criado `frontend/` (Vite + React + TypeScript): tela de chat simples (`App.tsx`), consumindo `POST http://localhost:3001/api/chat`.
- Criado `backend/` (Fastify + TypeScript, `type: module`):
  - `src/db.ts` — SQLite (`better-sqlite3`), tabela `messages` (id, author, text, created_at).
  - `src/server.ts` — `/api/health` e `/api/chat` (resposta fixa por enquanto; sem IA real ainda).
- Validado de ponta a ponta: front em `localhost:5173`, back em `localhost:3001`, mensagens gravando no SQLite (`backend/papo-reto.db`).
- Decisão registrada: Ollama local no lugar da API Claude, pelo custo.

### 2026-10-27 — Fase 01 concluída

- Criado `backend/src/agent.ts`: chama `POST http://localhost:11434/api/chat` do Ollama (modelo `llama3.1:8b`), com o `SYSTEM_PROMPT` do modo Normal (tom acolhedor, corrige com exemplo, nunca ironiza) — igual ao definido na seção 03 do plano.
- `server.ts` agora monta o histórico (últimas 20 mensagens do SQLite) como contexto de conversa a cada chamada, em vez de responder com texto fixo.
- Testado manualmente: erro de gramática ("I have went to the store") gerou correção em contexto; mensagem seguinte manteve o assunto da conversa anterior (histórico multi-turn funcionando).
- Tratamento de erro simples: se o Ollama não responder, o endpoint devolve HTTP 503 com uma mensagem clara em vez de travar.
- Limpas as duas mensagens de teste da Fase 00 do banco (resposta fixa antiga), pra não poluir o histórico de contexto permanentemente.

**Próximo passo:** Fase 02 — tela de onboarding (nome, objetivo, nível percebido, modo do agente) e a máquina de estados de humor por sessão (Normal vs. Exigente).

### 2026-10-27 — Fase 02 concluída

- Nova tabela `profile` (SQLite): nome, objetivo, nível percebido, modo (`normal`/`brava`). Usuário único, sempre `id = 1`.
- Backend: `GET/POST /api/profile` (onboarding e troca de modo); `/api/chat` agora exige perfil e calcula o `mood` (`calmo`/`atento`/`no_limite`) a partir da contagem de mensagens do usuário na conversa.
- `agent.ts`: prompt dividido em três camadas — base (sempre), modo (Normal vs. Exigente, como na seção 03 do plano) e humor (calmo/atento/no_limite). No modo Normal, o humor nunca passa de "atento" — só o modo Exigente chega a "no_limite".
- **Simplificação assumida:** o humor sobe pela contagem de mensagens na conversa, não por "erros do mesmo tipo" como o plano original sugeria — ainda não temos classificação estruturada de erro. Fica anotado para revisar quando a Fase 05 (revisão de erros recorrentes) adicionar isso.
- Frontend: tela de onboarding (nome, objetivo, nível, escolha do modo) e um botão de configurações no chat pra trocar o modo a qualquer momento.
- **Testado e validado:** mesma frase errada repetida 5x no modo Exigente escalou de "calmo" até "(firmly) That's it, I've had enough!" (no_limite) sem nunca insultar a pessoa; no modo Normal, com a mesma contagem de mensagens, o tom ficou em "atento" ("Can you try that one, please?") — confirma que o mesmo erro gera tom visivelmente diferente entre os dois modos, e que trocar o modo nas configurações muda o comportamento na próxima mensagem.
- **Risco novo encontrado:** nesta máquina, a inferência local às vezes passou de 90s numa única resposta (CPU, sem GPU). Pode valer revisitar o tamanho do modelo (ex. `llama3.1:8b` → algo menor) se isso incomodar no uso real.

**Próximo passo:** Fase 03 — currículo A1–C2 em JSON versionado, quiz de posicionamento, trilha de lições.

### 2026-10-27 — Fase 03 concluída

- `backend/content/curriculum.json`: 5 níveis (A1–C1), 2 lições cada, com objetivos, vocabulário e uma frase "starter" que inicia uma conversa focada no tópico.
- `backend/content/placement-quiz.json`: 10 perguntas de gramática, 2 por nível (A1 a C1).
- `backend/src/content.ts`: carrega os JSONs e calcula o nível sugerido — varre os níveis em ordem e para no primeiro onde o aluno não acertou nenhuma pergunta; o nível sugerido é o último em que ele acertou algo.
- Novos endpoints: `GET/POST /api/placement-quiz`, `GET /api/curriculum`, `POST /api/lessons/:id/complete`. Nova tabela `lesson_progress`.
- **Mudança na onboarding:** o select manual de nível virou um quiz de posicionamento real (como estava planejado na seção 04 do plano — "mais honesto que autoavaliação").
- Frontend: app agora tem abas **Chat** e **Trilha**. A Trilha mostra as lições por nível, com o nível atual marcado; "Praticar" manda a frase starter da lição pro chat; "Marcar como concluída" persiste o progresso.
- **Testado via API:** respostas simuladas corretas até B1 e erradas em B2 → nível sugerido = B1 (correto); lição `a1-apresentacao` marcada concluída persistiu no currículo (as outras continuaram `false`).

**Próximo passo:** Fase 04 — voz: fala do usuário via STT, resposta do agente via TTS, exercício de repetição de frase.

### 2026-10-28 — Fase 04 concluída

- `frontend/src/useSpeech.ts`: hook com STT (`SpeechRecognition`/`webkitSpeechRecognition`) e TTS (`speechSynthesis`), nativos do navegador — só Chrome/Edge reconhecem fala em inglês de forma confiável. Também tem `scoreAttempt`/`feedbackFor`: compara a frase alvo com o que foi reconhecido (match de palavras) e devolve um feedback (✅/⚠️/❌).
- Chat: botão de microfone no composer (transcreve a fala pro campo de texto, sem enviar automaticamente — o usuário revisa antes), e toggle 🔊/🔇 que fala em voz alta cada resposta nova do agente.
- Trilha: "Praticar" agora abre um exercício de repetição (🔊 Ouvir a frase, 🎤 Repetir, feedback) antes de continuar pro chat com a conversa daquela lição.
- **Bug real encontrado e corrigido durante o teste visual:** `color-scheme: light dark` (herdado do template padrão do Vite) deixava botões com texto branco sobre fundo branco — completamente invisível — em qualquer navegador com tema escuro no sistema. Trocado para `color-scheme: light` em `index.css`, já que o app não tem suporte a tema escuro ainda.
- **Testado via navegador (Claude in Chrome):** passei pelo onboarding, quiz, trilha e exercício de repetição de ponta a ponta; confirmei os elementos de voz presentes e funcionando sem erros no console (só ruído conhecido de extensão do Chrome, não do app). **Limitação honesta:** não dá pra validar o reconhecimento de fala em si (precisa de microfone real e permissão do navegador) nem ouvir o áudio da TTS a partir daqui — isso só o usuário consegue confirmar na prática.

**Próximo passo:** Fase 04 concluída — ver decisão abaixo sobre a nova Fase 05.

### 2026-10-28 — Novos requisitos definidos (ainda não implementados)

Você pediu três mudanças antes de seguir, registradas como a nova **Fase 05 — Avatar e naturalidade** no plano (as fases 05/06 antigas viraram 06/07):

1. **Voz mais natural** — a TTS do navegador (Fase 04) soa robotizada; avaliar Piper (TTS neural local, grátis) no lugar da `speechSynthesis` nativa.
2. **Regra de idioma** — o agente deve conversar, explicar e corrigir em **português**; só a frase que o aluno precisa praticar/repetir fica em **inglês**, sempre entre aspas. **Isso contradiz o que já está no ar:** o `SYSTEM_PROMPT` em `backend/src/agent.ts` (Fases 01–02) hoje manda o modelo responder inteiro em inglês ("Always reply in English"). Vai precisar reescrever as duas camadas de prompt (base + modo) e re-testar que o modo Exigente continua sem insultar, agora em português.
3. **Avatar minimalista** — só olhos e boca, flutuando centralizado na tela, mudando de expressão de acordo com o "nível de estresse" do agente. Isso mapeia direto pro `mood` (`calmo`/`atento`/`no_limite`) que o backend já calcula e devolve desde a Fase 02 (`POST /api/chat` já retorna `mood` na resposta) — não precisa de nada novo no backend, só consumir esse campo no front.

Decisão registrada no plano (seção 03 e riscos 06–07): https://claude.ai/code/artifact/1590f507-9d03-43ad-8104-d291880fda65

**Próximo passo:** Fase 05 — reescrever o prompt do agente com a regra de idioma, trocar a TTS por algo mais natural, e construir o avatar reagindo ao `mood`.

### 2026-10-28 — Fase 05 concluída

- **Piper instalado** (`pip3 install piper-tts`) com a voz `en_US-amy-medium` baixada em `backend/voices/`. Novo módulo `backend/src/tts.ts`: `synthesizeSpeech(text)` chama o binário `piper` via `child_process`, escreve um WAV temporário e devolve o buffer. Novo endpoint `POST /api/speak` serve esse áudio (`audio/wav`).
- **Prompt reescrito em `agent.ts`:** o agente agora responde em português — explicações, perguntas, correções — e só a frase que o aluno deve repetir fica em inglês, sempre entre aspas.
- **Bug real encontrado e corrigido durante o teste:** a extração da frase entre aspas (`extractPracticePhrase`) quebrava quando o modelo colocava uma palavra curta em inglês entre aspas no meio do texto (ex. `"I"`, 1 caractere) — meu regex exigia no mínimo 2 caracteres, então essa aspas "órfã" desalinhava o pareamento de todas as aspas seguintes, e a função acabava extraindo um pedaço aleatório do meio da frase em vez da frase-alvo. Corrigido: mínimo de 1 caractere, e um filtro que descarta qualquer trecho entre aspas com acento (modelo às vezes também bota um pedaço em português entre aspas — risco 01 do plano), pegando a última aspas válida que sobrar.
- **Avatar:** `frontend/src/Avatar.tsx`, SVG minimalista (só olhos + boca) flutuando no topo do chat, com três expressões (calmo/atento/no_limite) ligadas direto ao `mood` que o `/api/chat` já devolvia desde a Fase 02. Flutua com uma animação suave; no `no_limite` ganha um tremor sutil. Respeita `prefers-reduced-motion`.
- `useSpeech.ts`: `speak()` trocado de `window.speechSynthesis` pra buscar o áudio em `/api/speak` e tocar via `<audio>`. O Chat só manda pro Piper a `practicePhrase` (o trecho em inglês) — o resto da resposta, em português, não precisa de áudio.
- **Outro bug real, achado testando no navegador:** o chat não rolava pra última mensagem automaticamente — em conversas um pouco mais longas, a resposta nova ficava fora da área visível. Corrigido com `scrollIntoView` num `useEffect` que dispara a cada mensagem nova.
- **Testado de ponta a ponta no navegador:** troquei o modo, mandei mensagens com erro, confirmei resposta 100% em português com a frase-alvo em inglês destacada, vi o avatar mudar de calmo (verde) pra atento (âmbar) ao vivo na 3ª mensagem da sessão, e confirmei no painel de rede que `/api/speak` foi chamado com sucesso (200) a cada resposta com frase de prática.

**Próximo passo:** Fase 06 — streak diário, missões semanais, celebração visual, revisão de erros recorrentes.

### 2026-10-28 — Fase 06 concluída

- **Streak:** nova tabela `activity_log` (uma linha por dia usado). `backend/src/streak.ts` calcula a sequência andando pra trás a partir de hoje enquanto os dias existirem no log, e um contador de dias ativos nos últimos 7 dias. Chamado a cada `/api/chat`. Testado manualmente simulando datas no banco: dia 1 (`current:1`), dia consecutivo (`current:2`), e hiato de 3 dias quebrando a sequência de volta pra 1 — os três cenários bateram certo.
- **Revisão de erros recorrentes:** nova tabela `mistakes` (texto original + frase corrigida). Toda vez que o agente devolve uma `practicePhrase` diferente do que o aluno escreveu, vira candidata a revisão. Nova aba **Revisão** no front lista as frases mais corrigidas (`GROUP BY correct_phrase ORDER BY count DESC`), cada uma com um botão "Praticar" que reaproveita o mesmo componente de repetição de frase da Fase 04/05 — sem UI nova pra isso.
  **Limitação honesta:** a heurística ("practicePhrase ≠ texto original = erro") é aproximada — às vezes o agente sugere uma frase nova pra continuar a conversa (não uma correção de erro de verdade), e isso também entra na lista de revisão. Confirmei isso ao vivo: num teste, "Hello" entrou como "erro recorrente" sem ser um erro real. Fica registrado como simplificação; corrigir direito exigiria o agente marcar explicitamente quando está corrigindo vs. só propondo uma frase nova.
- **Celebração visual:** confete simples em CSS (`Confetti.tsx`, sem biblioteca externa) dispara quando `streak.isNewDay` vem `true` na resposta do chat — ou seja, na primeira interação de cada dia novo.
- Badge de streak (🔥 N) sempre visível no topo, nas três abas (Chat/Trilha/Revisão).
- **Testado no navegador:** badge de streak aparecendo corretamente, aba Revisão listando os dois "erros" de teste ordenados por frequência, botão "Praticar" abrindo o drill de repetição com a frase certa.

**Próximo passo:** Fase 07 — PWA instalável, dashboard pessoal de evolução, exportar progresso.

### 2026-10-28 — Fase 07 concluída (roadmap completo)

- **PWA:** `frontend/public/manifest.webmanifest`, ícones gerados com Pillow (mesmo motivo do avatar — olhos + boca — em `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`) e um `sw.js` mínimo (sem cache/offline real, só pra satisfazer o critério de instalação do navegador — o app depende do backend + Ollama locais de qualquer forma). `index.html` atualizado com o título, favicon e registro do service worker.
- **Dashboard pessoal:** nova aba **Progresso** — nível atual, streak, dias ativos na semana, minutos de prática estimados, lições concluídas/total, e os 5 erros mais corrigidos. Backend: `GET /api/dashboard`.
  - `practiceMinutes` é estimado somando os intervalos entre mensagens consecutivas de até 5 minutos (`backend/src/stats.ts`) — reaproveita o `created_at` que já existia, sem instrumentação nova.
- **Exportar progresso:** `GET /api/export` devolve um JSON com perfil, lições concluídas, erros, histórico de atividade e métricas; botão "Exportar progresso" no dashboard baixa o arquivo. Testado de ponta a ponta: cliquei no botão e confirmei o arquivo `papo-reto-progresso.json` chegando em `~/Downloads`.
- **Atalho no Desktop:** `start.command` na raiz do projeto (também copiado pra `~/Desktop/Papo Reto.command`) — confere se Ollama/backend/frontend estão de pé, inicia o que faltar, espera ficar pronto e abre `localhost:5173` no navegador.
  - **Bug real encontrado e corrigido:** a primeira versão usava `cd "$(dirname "$0")"` (caminho relativo ao próprio script) — funcionava rodando de dentro do projeto, mas quebrava na cópia do Desktop, porque lá não existe `backend/`/`frontend/` do lado do atalho. Corrigido pra um caminho absoluto fixo.
  - **Testado com um "cold start" de verdade:** matei os processos do backend e do frontend, rodei o atalho do Desktop do zero, e confirmei os dois subindo e o navegador abrindo sozinho.

**Todas as 8 fases do roadmap (00–07) estão concluídas e validadas.** O Papo Reto roda localmente: Ollama (Llama 3.1 8B) como agente conversacional em português com frase de prática em inglês, dois modos de personalidade, avatar reagindo ao humor, voz natural via Piper, trilha A1–C1 com quiz de posicionamento, streak + revisão de erros, dashboard de progresso exportável, e um atalho no Desktop pra abrir tudo de uma vez.

### 2026-10-28 — Fase 08 concluída (correção e otimização)

Varredura pedida sobre velocidade e frontend, e um relato de que o botão de microfone "aparentemente não funciona".

- **Bug real do microfone corrigido:** em `frontend/src/useSpeech.ts`, `recognition.start()` não tinha `try/catch` — se o Chrome recusasse iniciar uma nova sessão de reconhecimento enquanto a anterior ainda não tinha fechado de verdade (troca rápida de aba, re-clique no botão), a exceção não era capturada e o estado `listening` ficava travado em `true` pra sempre (botão preso em "🎙️ Ouvindo..." até recarregar a página). Corrigido com `try/catch` e um `useEffect` de cleanup dentro do próprio hook, que para o reconhecimento automaticamente se o componente desmontar. Erros agora também aparecem na tela em português (permissão negada, sem conexão, sem microfone, nada ouvido) em vez de falhar em silêncio — antes disso, uma falha de permissão era indistinguível de "não funciona".
  - **Testado no navegador:** cliquei o mic sem falar nada e confirmei a mensagem de erro aparecendo e o botão voltando ao normal; cliquei o mic e troquei de aba no meio da escuta (simulando o desmonte) e confirmei zero erros `InvalidStateError` no console e o botão funcionando normalmente ao voltar.
- **Streaming no chat:** `backend/src/agent.ts` e `/api/chat` agora respondem em NDJSON (`stream:true` pro Ollama, repassado pedaço a pedaço) em vez de esperar a resposta inteira — no CPU dessa máquina uma resposta podia levar até 90s (risco já registrado na Fase 02) com a tela completamente parada nesse tempo. Front mostra "digitando..." até o primeiro pedaço chegar, depois o texto vai aparecendo progressivamente. Testado via `curl -N` (chunks chegando em pedaços pequenos, não tudo de uma vez) e via `tsc` nos dois lados.
- **Timeouts:** nenhuma chamada (Ollama, Piper, `/api/speak`) tinha timeout — se travassem, a requisição ficava pendurada indefinidamente. Adicionado `AbortSignal.timeout` nas três.
- **Cache de TTS:** `backend/src/tts.ts` agora cacheia o WAV em disco por hash do texto (`.tts-cache/`) — frases repetidas (starters da Trilha, frases da Revisão) não spawnam o Piper de novo. Testado via `curl`: primeira chamada 2.3s, segunda chamada (mesmo texto) 0.8s, bytes idênticos.
- **Build de produção:** `start.command` (e a cópia em `~/Desktop/Papo Reto.command`) agora builda o frontend (`npm run build`) e serve com `vite preview` em vez de `vite dev` — o app "pronto" não precisa mais do modo desenvolvimento (sem bundle, sem minificação) no uso diário. Testado: build gerado em ~1s, `vite preview` servindo o bundle novo na porta 5173.
- **Limpeza:** URL do backend (`http://localhost:3001`) estava duplicada em `App.tsx` e `useSpeech.ts` — extraída pra `frontend/src/api.ts`. Também corrigida uma linha duplicada/órfã na tabela de fases deste arquivo ("06 — Polimento e PWA local | Não iniciada").

**Risco em aberto, não resolvido nesta fase:** o reconhecimento de voz do Chrome (`SpeechRecognition`) não é 100% local — ele manda o áudio pros servidores da Google pra transcrever. Num app pensado como "tudo local" (Ollama + Piper + SQLite), isso significa que o microfone para de funcionar sem internet, mesmo com o resto do app rodando normalmente. Fica registrado como limitação conhecida da Web Speech API, não um bug — upgrade futuro seria `faster-whisper` local, já cogitado desde a Fase 04.

### 2026-10-28 — Fase 09 concluída (redesign visual e voz de verdade)

Você pediu pra deixar o front-end "com cara mais amigável e profissional" e diminuir o campo de chat, já que o foco é a conversação por voz, não o chat digitado.

- **Causa raiz visual encontrada:** `frontend/src/index.css` ainda era o CSS genérico do template do Vite/Astro usado no scaffold da Fase 00 — nunca tinha sido customizado. Tinha um acento roxo (`#aa3bff`) sem relação com o app, um `#root` com largura fixa de 1126px e texto centralizado (pensado pra outro tipo de site), e um bloco `@media prefers-color-scheme: dark` que forçava fundo quase preto fora dos cards mesmo com `color-scheme: light` já setado — foi isso que explicava aquele fundo preto estranho ao redor dos elementos claros. Reescrito com um sistema de tokens de design próprio do Papo Reto (cor de marca, superfícies, bordas, sombras), e removido o que não fazia sentido.
- **Foco na conversação, não na digitação:**
  - Novo "palco" (`.stage` em `App.tsx`/`App.css`): Avatar centralizado e, logo abaixo, um botão grande "🎤 Falar" — virou o centro visual da tela, não mais escondido dentro do composer de texto.
  - `.messages` (histórico de texto) encolheu de ocupar a tela quase toda (`flex:1` dentro de uma `.chat` de 80vh) pra uma faixa fixa de ~180px, com visual de "transcrição" discreta em vez de bolhas grandes de chat.
  - Composer de texto virou claramente secundário: placeholder "Ou digite aqui, se preferir...", botão "Enviar" (antes "Send", inconsistente com o resto da UI em português), mic removido de lá (ficou só no palco — um único ponto de entrada por voz).
  - Avatar aumentado (120×96 → 150×120) pra reforçar que ele é o protagonista.
  - Telas principais (Chat, Trilha, Progresso, Revisão, Onboarding) viraram cards com sombra suave e cantos arredondados; abas viraram um controle segmentado; botões ganharam hover/transições.
- **Bug real de captura de voz encontrado e diagnosticado (fora do código):** depois do redesign, você testou e a voz não estava sendo captada. Usando `getUserMedia` + `AnalyserNode` direto no navegador pra medir o nível de áudio captado em tempo real, confirmei sinal **zero** chegando — o Chrome estava usando como microfone da página o **"NDI Audio (Virtual)"** (dispositivo virtual, provavelmente de alguma ferramenta de streaming instalada na máquina) em vez do microfone físico, mesmo o macOS tendo o `MacBook Air Microphone` corretamente marcado como padrão do sistema. Causa: o dispositivo padrão do **Chrome** pra captura de áudio (`chrome://settings/content/microphone`) é separado do padrão do **sistema operacional**, e estava apontando pro dispositivo errado. Resolvido por você trocando esse dropdown pro microfone físico — confirmei depois com o mesmo teste de nível de áudio que o problema não era mais de código nem de infraestrutura do app.
- **Outro bug real, de produto:** com o mic resolvido, a fala transcrita aparecia certinha no campo de texto, mas nada acontecia — reproduzi isso e vi exatamente esse estado na tela (texto parado no input, nunca enviado). Era um comportamento deliberado da Fase 04 ("transcreve pro campo de texto, sem enviar automaticamente, o usuário revisa antes"), mas com o microfone agora sendo a interação principal do redesign, ficou parecendo que "o app não responde". Corrigido: `recordInput` em `App.tsx` agora chama `sendMessage(transcript)` direto depois da transcrição — fala manda na hora, como numa conversa de verdade. Digitar manualmente continua exigindo o clique em "Enviar", pra quem quiser revisar antes.
  - **Testado no navegador de ponta a ponta:** mandei uma mensagem de texto pra confirmar que o envio (manual e, por extensão, o caminho da voz que usa a mesma função) continuava funcionando depois da mudança de assinatura de `sendMessage` — indicador "digitando..." apareceu, avatar mudou de humor em tempo real, resposta completa chegou via streaming.

**Lição registrada:** boa parte dos "bugs" dessa fase não estavam no código do Papo Reto — eram configuração do navegador/SO (dispositivo de áudio) e um comportamento de produto que fazia sentido isolado mas não fazia mais sentido depois que a interação principal mudou de "digitar" pra "falar". Vale lembrar disso ao revisar decisões antigas quando a interface muda de foco.

### 2026-10-28 — Fase 10 planejada (conversa 100% em áudio)

Pedido: a conversa deve funcionar como um bate-papo real entre professora e aluno — tudo que o aluno digita (ou fala) recebe resposta **em áudio**, não só a frase de prática em inglês destacada entre aspas.

**Limitação atual que motiva a fase:** desde a Fase 05, `useSpeech.speak()` e `/api/speak` só tocam a `practicePhrase` (o trecho em inglês entre aspas) — a explicação em português, que é a maior parte de toda resposta do agente desde a mudança de idioma, nunca é falada. O Piper também só tem a voz `en_US-amy-medium` instalada (`backend/voices/`), que não lê português corretamente.

**Plano, em sub-fases:**

1. **Voz da professora em português** — baixar uma voz Piper `pt_BR` (ex.: `pt_BR-faber-medium`, lista completa em https://github.com/rhasspy/piper/blob/master/VOICES.md) pra `backend/voices/`. `tts.ts`: `synthesizeSpeech(text, lang)` passa a escolher o modelo (`en_US-amy-medium` ou o `pt_BR-*`) por idioma do segmento, em vez de um caminho fixo.
2. **Falar a resposta inteira, não só a frase de prática** — nova função em `tts.ts` (variação de `extractPracticePhrase`) que divide a resposta completa em segmentos ordenados `{texto, lang}`, alternando português (fora das aspas) e inglês (dentro das aspas), em vez de extrair só a última frase. `/api/speak` passa a aceitar essa lista (ou o front já manda os segmentos calculados) e devolve os áudios na ordem certa.
3. **Fila de áudio no front** — `useSpeech.ts` ganha uma fila que toca os segmentos em sequência, trocando de voz entre PT e EN sem sobrepor; o toggle 🔊/🔇 que já existe (`App.tsx`) passa a controlar essa fala completa, não só a frase isolada.
4. **Latência — fase crítica pra parecer um bate-papo de verdade** — hoje o áudio só pode começar depois do evento `done` do `/api/chat`, ou seja, depois da resposta de texto inteira terminar (até 90s nessa máquina, risco já registrado na Fase 08). Pra professora "falar enquanto ainda está pensando o resto", o backend precisa detectar fim de frase (`. ! ?` ou fechamento de aspas) dentro do próprio streaming NDJSON e emitir um evento novo (`{type:"speech", text, lang}`) tão que cada frase fica pronta — o front chama `/api/speak` nela sem esperar o fim da resposta.
5. **Garantir que vale pra texto digitado, não só pra voz** — hoje falar manda a mensagem direto (Fase 09) mas digitar exige clicar "Enviar"; o áudio da resposta já dispara pelos dois caminhos porque ambos passam por `sendMessage`, então isso só precisa de teste de ponta a ponta confirmando, não mudança de código.
6. **Nice-to-have, não bloqueia a fase:** cortar o áudio em reprodução se o aluno mandar mensagem nova no meio da fala (barge-in) — hoje só o último áudio tocado é pausado (`audioRef.current?.pause()`), confirmar que isso também esvazia a fila nova; e o avatar (`Avatar.tsx`) reagir visualmente enquanto o áudio toca (boca se movendo), não só pelo `mood`.

**Risco a monitorar:** sintetizar frase por frase multiplica o número de chamadas ao Piper (hoje já cacheadas por hash em `.tts-cache/`) — pode valer medir se o overhead de spawnar o processo por frase curta compensa o ganho de latência percebida, ou se um meio-termo (sintetizar por parágrafo, não por frase) já resolve.

**Próximo passo:** confirmar a voz `pt_BR` escolhida e começar pela sub-fase 1 (sem ela, nada do resto faz sentido ouvir).

### 2026-10-28 — Fase 10, sub-fases 1–3 e 5 implementadas

- **Voz PT-BR baixada:** `pt_BR-faber-medium` (`python3 -m piper.download_voices`) em `backend/voices/`, do lado da `en_US-amy-medium` já existente.
- **`tts.ts`:** `VOICE_MODELS` agora é um mapa por idioma (`SpeechLang = "pt" | "en"`); `synthesizeSpeech(text, lang)` escolhe o modelo certo; cache em `.tts-cache/` passou a incluir o idioma na chave (hash de `${lang}:${text}`) pra não colidir o mesmo texto em línguas diferentes.
- **Nova `splitSpeechSegments(text)`:** reaproveita a mesma regra de aspas da `extractPracticePhrase` (Fase 05), mas em vez de extrair só a última frase em inglês, corta a resposta inteira em segmentos ordenados `{texto, lang}` — português fora das aspas, inglês dentro (com o mesmo filtro de aspas "órfã" em português tratada como PT, não EN).
- **`/api/chat`:** o evento `done` do streaming NDJSON agora inclui `segments` junto com `practicePhrase`. **`/api/speak`:** passou a receber `{ text, lang }` em vez de só `text`.
- **Front (`useSpeech.ts`):** `speak(text, lang="en")` manteve a assinatura antiga (ainda usada pela Trilha pra tocar a frase isolada do exercício de repetição) e ganhou uma companheira, `speakSegments(segments)`, que toca os segmentos em sequência trocando de voz; um `speechRunId` garante que, se uma resposta nova chegar enquanto a anterior ainda está sendo falada, a fila antiga para de agendar os próximos segmentos em vez de sobrepor duas falas.
- **`App.tsx`:** `Message` ganhou `segments`; o efeito que disparava `speak(practicePhrase)` agora chama `speakSegments(last.segments)` — a professora passa a falar a explicação em português inteira, não só a frase em inglês destacada.
- **Testado via API (sem navegador — extensão do Claude in Chrome não conectada nesta sessão):** `curl -N /api/chat` com uma frase errada de propósito ("I have went to the store yesterday") devolveu `segments` corretamente alternados (`pt`→`en`→`pt`→`en`→`pt`→`en`); `curl /api/speak` com `lang:"pt"` e `lang:"en"` gerou dois WAVs válidos (RIFF/16-bit/22050Hz) com as vozes certas, confirmados ao ouvir com `afplay`. `tsc --noEmit` limpo nos dois lados e `npm run build` do frontend sem erros.
- **Não testado ainda (precisa do usuário ou de uma sessão com a extensão conectada):** o fluxo completo no navegador — fila de áudio tocando PT e EN em sequência sem sobreposição, e o corte de fala (barge-in) quando uma mensagem nova é mandada no meio da fala anterior.

**Risco em aberto, ainda não resolvido:** a sub-fase 4 do plano (falar por frase durante o streaming, em vez de esperar o `done`) não foi implementada — hoje o áudio só começa depois da resposta de texto inteira terminar, que pode levar até 90s nessa máquina. Pra essa resposta de teste (mais curta), o áudio começou a tocar poucos segundos depois do fim do texto; em respostas mais longas o atraso ainda deve ser perceptível.

**Próximo passo:** você testar no navegador (backend em `:3001`, front buildado em `:5173` já rodando) pra confirmar que a fala soa natural e sem sobreposição; depois decidir se vale a pena atacar a sub-fase 4 (latência) ou se o atraso atual já é aceitável no uso real.

### 2026-10-28 — Dois bugs reais de naturalidade corrigidos

Relato: a fala estava "robotizada" e travava no meio da frase pra trocar de voz entre português e inglês.

- **Causa raiz nº1 (a pausa de verdade):** em `useSpeech.speakSegments`, cada segmento só era sintetizado quando chegava sua vez — ou seja, o Piper só começava a gerar o áudio do próximo segmento depois que o anterior **terminava de tocar**. Como o Piper gasta ~1-2s pra sintetizar um texto novo (a resposta do agente nunca repete, então quase nunca bate no cache), isso criava uma pausa real a cada troca de idioma, não só uma troca de timbre. **Corrigido:** `speakSegments` agora sintetiza todos os segmentos em paralelo (`Promise.all`) antes de tocar o primeiro — a troca entre eles passa a ser só o tempo de iniciar o próximo áudio já pronto.
- **Causa raiz nº2 (trocas demais numa resposta só):** `agent.ts` pede pro modelo citar em inglês, entre aspas, só a frase-alvo — mas o Llama 3.1 8B local nem sempre obedece: numa resposta só, ele citava a forma errada ("I has two cats"), a forma certa ("I have two cats") e repetia a certa no final, o que fazia a fala trocar de voz PT→EN→PT→EN→PT→EN dentro da mesma resposta (confirmado via `curl` antes da correção). Reforcei o prompt pra "use aspas EXATAMENTE UMA vez por resposta", mas o modelo continuou sem obedecer à risca depois do teste — então a correção definitiva foi em `splitSpeechSegments` (`tts.ts`): em vez de confiar na disciplina do modelo, só a **última** aspas válida (mesma frase que `extractPracticePhrase` já escolhia) vira um segmento em inglês; qualquer aspas anterior (a forma errada, por exemplo) é achatada de volta no texto em português ao redor, sem criar um segmento novo. Isso garante no máximo **uma** troca de voz por resposta, independente de quantas vezes o modelo cite algo em inglês.
  - **Trade-off assumido:** palavras ou frases em inglês citadas antes da frase-alvo (ex.: a forma errada do aluno) agora são lidas com a voz em português, com pronúncia errada pro inglês — preferível a múltiplas trocas de voz no meio de uma explicação, mas é uma perda de precisão nessas citações específicas.
- **Testado via `curl` em `/api/chat` + `/api/speak` + `afplay`:** confirmado que a resposta de teste ("I has two cats") agora gera só 2 segmentos (`pt`, `en`) em vez de 6, e os dois áudios tocam em sequência sem a pausa anterior. `tsc --noEmit` limpo nos dois lados, build do frontend sem erros, `vite preview` já servindo o bundle novo sem precisar reiniciar.
- **Não testado ainda no navegador** (extensão do Claude in Chrome não conectada nesta sessão) — falta confirmar ao vivo que a troca de voz única no fim da frase soa natural, não abrupta.

### 2026-10-28 — Fase 11 planejada (motor Gemini, chave do próprio usuário)

Pedido: usar a Gemini API pra deixar as respostas mais rápidas e naturais, sem custo centralizado — cada usuário cola a própria chave de API (gerada de graça no Google AI Studio) nas configurações do Papo Reto, no padrão "bring your own key". Descartamos a ideia de login OAuth com conta Gemini Pro/Enterprise: a assinatura do app Gemini não concede acesso de API pra terceiros, só a chave de desenvolvedor (gratuita ou paga) resolve.

**Por que isso ataca a raiz dos problemas das Fases 09-10:** o Ollama local (Llama 3.1 8B, CPU, sem GPU) é lento (até 90s por resposta) e segue mal a instrução de "aspas uma vez" (causa da troca de voz excessiva corrigida na Fase 10 só na camada de segmentação, não na origem). Um modelo Gemini na nuvem deve ser bem mais rápido e obedecer melhor o formato — ataca os dois problemas na origem, não só mitiga.

**Plano, em sub-fases:**

1. **Configurações: campo pra colar a chave** — como o app é de usuário único (`profile` tem sempre `id=1` em `db.ts`), basta uma coluna nova (`gemini_api_key TEXT`, nullable) na tabela `profile` — sem necessidade de tabela separada ou multi-tenant. Tela de configurações (já existe o painel que troca Normal/Exigente) ganha um campo de texto (tipo senha, mascarado) pra colar a chave, com um aviso claro: "ao usar sua chave Gemini, suas conversas passam a ser processadas pelos servidores do Google, não só na sua máquina."
2. **Campo de motor no perfil** — `profile.engine: "ollama" | "gemini"` (default `"ollama"`, preserva o comportamento 100% local pra quem não tem chave). Troca de motor no mesmo painel de configurações, ao lado do campo da chave; se escolher `"gemini"` sem chave preenchida, bloquear com aviso em vez de quebrar silenciosamente.
3. **`agent.ts`: nova função `streamAgentGemini`** — mesma assinatura de `streamAgent` (history, mode, mood, onChunk), mas chamando a Gemini API (`@google/genai`, streaming) com a chave do usuário, reaproveitando os mesmos `BASE_PROMPT`/`MODE_PROMPT`/`MOOD_PROMPT` como `system_instruction` em vez de mensagem `role: "system"` (formato da Gemini é um pouco diferente do Ollama). `server.ts` escolhe qual função chamar baseado em `profile.engine`.
4. **Fallback automático** — se a chamada à Gemini falhar (chave inválida, cota excedida, sem internet), `/api/chat` cai pro `streamAgent` (Ollama) nessa mesma requisição em vez de só devolver erro — preserva a promessa de "funciona local" mesmo com o motor cloud configurado.
5. **Medir o ganho de verdade** — comparar, com a mesma frase de teste, o tempo de resposta e quantas vezes o Gemini cita aspas por resposta (via `curl`) contra os números já registrados do Ollama (Fase 08: até 90s; Fase 10: até 3 pares de aspas numa resposta só) — confirmar que a troca realmente resolve antes de assumir que resolveu.
6. **TTS: avaliar o modelo de voz da própria Gemini** — pesquisar se um modelo de TTS da Gemini consegue ler português e inglês na mesma frase com uma única voz coerente (sem precisar alternar dois modelos Piper). Se a qualidade/latência compensar, usar a chave do usuário também pra síntese de voz, mantendo Piper como motor de voz padrão (grátis, local) pra quem não configurou a chave.
7. **(Fase futura, não bloqueia esta)** — avaliar o Live API da Gemini (fala-para-fala nativa, streaming bidirecional por WebSocket) pra eliminar texto+TTS como dois passos separados; é um ganho maior de naturalidade, mas exige reescrever a arquitetura de transporte do front (WebSocket/WebRTC em vez de fetch+NDJSON) — fica registrado como direção futura, não faz parte do escopo inicial.

**Riscos a monitorar:**
- **Privacidade:** com o motor Gemini ativo, a conversa do aluno (incluindo erros e frases pessoais) sai da máquina e vai pros servidores do Google — precisa ficar visível pro usuário na UI, não só documentado aqui.
- **Cota da camada gratuita:** mesmo de graça, tem limite de requisições por minuto/dia — o fallback da sub-fase 4 cobre isso, mas vale deixar uma mensagem clara quando cair pro Ollama por esse motivo, não um erro genérico.
- **Chave em texto no SQLite local:** aceitável pra um app single-user na própria máquina do aluno, mas não deve nunca ser logada (`console.log`) nem devolvida inteira pelo `GET /api/profile` (mascarar, ex. mostrar só os 4 últimos caracteres).

**Próximo passo:** sub-fase 1 (campo de configuração da chave) — sem ela, nada do resto tem como ser testado de verdade.

### 2026-10-28 — Fase 11, sub-fases 1–4 implementadas

- **`db.ts`:** migração via `ALTER TABLE` (não recriação) adiciona `engine` (default `'ollama'`) e `gemini_api_key` (nullable) na tabela `profile` existente — perfis já criados antes desta fase não se perdem.
- **`agent.ts`:** novo `Engine = "ollama" | "gemini"`; nova `streamAgentGemini(history, mode, mood, apiKey, onChunk)` com a mesma assinatura de `streamAgent`, chamando `generativelanguage.googleapis.com/.../gemini-2.0-flash:streamGenerateContent?alt=sse` — reaproveita os mesmos `BASE_PROMPT`/`MODE_PROMPT`/`MOOD_PROMPT` como `system_instruction`, e mapeia `role: "assistant"` pra `"model"` (nome que a Gemini usa).
- **`server.ts`:**
  - `GET /api/profile` nunca devolve a chave crua — só `hasGeminiKey: boolean`.
  - `POST /api/profile` aceita `engine`; se vier `"gemini"` sem chave já salva no banco, rejeita com 400 em vez de aceitar e quebrar silenciosamente no chat.
  - Novo `POST /api/gemini-key` (`{ apiKey }`, vazio pra remover) — endpoint próprio, pra não correr o risco de o front reenviar o valor mascarado do GET e sobrescrever a chave real.
  - `/api/chat`: se `profile.engine === "gemini"` e há chave salva, tenta `streamAgentGemini`; se falhar (chave inválida, cota, rede), emite um evento novo `{type:"engine-fallback", reason}` no NDJSON e completa a mesma resposta com `streamAgent` (Ollama) — sem chave ou com `engine:"ollama"`, usa Ollama direto, sem nenhum aviso.
  - **Limitação conhecida, registrada no código:** se a Gemini já tiver mandado algum pedaço de texto antes de falhar no meio do stream, esse texto parcial já chegou no front antes do fallback — a resposta do Ollama entra "colada" nele. Não tratado ainda; a maioria das falhas reais (chave inválida, cota, sem rede) acontece antes do primeiro chunk.
- **Front (`App.tsx`):** `Profile` ganhou `engine` e `hasGeminiKey`. Painel de configurações ganhou uma segunda linha (Ollama local / Gemini com sua chave — o botão Gemini fica desabilitado sem chave salva) e um campo pra colar/remover a chave, com aviso fixo de privacidade quando o motor Gemini está ativo. Novo evento `engine-fallback` do stream aparece como um aviso temporário acima do chat (reaproveitando o estilo de erro do microfone).
- **Testado via `curl` em todo o ciclo:** `GET /api/profile` sem chave/com chave (nunca expõe o valor); `POST /api/profile` com `engine:"gemini"` sem chave rejeitado com 400; `POST /api/gemini-key` salvando e removendo; `POST /api/profile` com `engine:"gemini"` aceito depois de ter chave; `/api/chat` com uma chave fake confirmando o evento `engine-fallback` seguido da resposta completa via Ollama; `/api/chat` com `engine:"gemini"` e chave já removida usando Ollama direto, sem aviso. `tsc --noEmit` limpo nos dois lados, build do frontend sem erros, `vite preview` servindo o bundle novo.
- **Não testado ainda:** uma chave Gemini real (não tenho uma) — então o ganho de velocidade e disciplina de aspas que motivou a fase ainda não foi confirmado na prática, só a infraestrutura em volta dela (storage, troca de motor, fallback). Também não testado no navegador (extensão do Claude in Chrome não conectada nesta sessão).

**Próximo passo:** você colar sua própria chave do Google AI Studio no painel de configurações (⚙️ dentro do Chat) e testar uma conversa de verdade — aí a gente mede o tempo de resposta e confere se o Gemini realmente respeita a regra de "aspas uma vez" melhor que o Llama local (sub-fase 5 do plano).

### 2026-10-28 — Fase 11, sub-fase 5: teste com chave real e dois bugs reais corrigidos

Você passou sua chave de API real e testamos o motor Gemini de ponta a ponta pela primeira vez.

- **Bug real nº1 — modelo descontinuado:** `agent.ts` tinha `GEMINI_MODEL = "gemini-2.0-flash"` fixo, mas esse modelo não existe mais — a própria API devolve 404 com a mensagem "This model models/gemini-2.0-flash is no longer available". **Corrigido:** troquei pra `"gemini-flash-latest"`, um alias que a Gemini mantém sempre apontando pro Flash vigente (hoje resolve pra `gemini-3.8-flash`) — protege contra a próxima descontinuação do mesmo tipo.
- **Bug real nº2 — "thinking" consumindo tempo sem necessidade:** um teste manual (`curl` direto na API, fora do nosso backend) mostrou 261 tokens de raciocínio interno (`thoughtsTokenCount`) só pra responder "diga oi" — o modelo Flash mais novo pensa por padrão antes de responder, o que é desperdício de latência pra uma correção de gramática simples. **Corrigido:** `generationConfig.thinkingConfig.thinkingBudget: 0` na chamada.
- **Achado real, não é bug nosso:** depois dessas duas correções, a chamada à Gemini (direta via `curl`, fora do nosso backend) alternou entre um **200 limpo** (confirmando que a chave funciona e a resposta vem certa) e **503 "This model is currently experiencing high demand"** ou timeout sem resposta — isso é instabilidade do lado do Google no tier gratuito do modelo Flash, não algo que o Papo Reto controla. Testado via `/api/chat` do nosso backend: nas duas tentativas que caíram nessa instabilidade, o **fallback pro Ollama (sub-fase 4) funcionou certinho** — emitiu `engine-fallback` e completou a resposta pelo motor local, sem travar nem devolver erro pro aluno.
- **Ainda não medido:** como a instabilidade do Google impediu uma chamada completa via streaming pelo nosso backend nesta sessão, não dá pra confirmar ainda o ganho real de velocidade nem se o Gemini respeita melhor a regra de "aspas uma vez" (só confirmamos isso com um `generateContent` simples direto, fora do fluxo de correção de gramática completo). Fica pendente repetir o teste de velocidade/disciplina de aspas quando a demanda no lado do Google normalizar.
- **Nota de segurança:** você colou a chave direto no chat — ela foi usada só pra configurar o `papo-reto.db` local (confirmei antes que esse arquivo está no `.gitignore` e nunca foi commitado) e não foi repetida nesta nota. Da próxima vez, cole direto no campo de configurações (⚙️) dentro do próprio app — vai direto pro backend local, sem passar pela conversa.

**Próximo passo:** repetir o teste de `/api/chat` com o motor Gemini em outro momento (demanda do lado do Google costuma ser temporária, segundo a própria mensagem de erro) pra medir tempo de resposta de verdade e confirmar a disciplina de aspas; se a instabilidade persistir, vale reavaliar se o tier gratuito do Flash é confiável o suficiente pro uso diário ou se compensa manter o Ollama como padrão por enquanto.

### 2026-10-28 — Instabilidade do Gemini confirmada com mais precisão

Você relatou que o app continuou caindo no aviso "Gemini não respondeu". Isolei exatamente onde trava:

- `GET /v1beta/models/gemini-flash-latest` (metadados do modelo, sem gerar texto) — responde normal, **200 em 0,77s**. Confirma que a chave e a autenticação estão certas.
- `POST .../generateContent` (o que realmente gera a resposta) — trava completamente, **sem devolver nem erro**, até o timeout de 20s estourar do nosso lado.

Ou seja: não é a chave, não é nosso código, não é nossa rede — é a capacidade de geração do Google sobrecarregada no tier gratuito agora mesmo, de um jeito que nem chega a devolver o 503 "alta demanda" de antes, só trava a conexão. É exatamente o risco que já tínhamos anotado no plano da Fase 11 ("cota da camada gratuita"), só que na prática virando indisponibilidade, não erro de cota.

**O fallback está fazendo o trabalho dele:** o app nunca quebra pro aluno — só demora mais, porque cai pro Ollama local. Mas o ganho de velocidade que motivou a fase não está disponível agora, de fato.

**Próximo passo:** por enquanto, recomendado deixar o motor em Ollama como padrão (`profile.engine = "ollama"`) e só tentar o Gemini de novo mais tarde, verificando antes com um teste rápido de `generateContent` se a demanda já normalizou — sem precisar trocar o motor no app pra descobrir isso só quando uma conversa real falhar.

### 2026-10-28 — Fase 12 planejada (otimizar o motor Ollama)

Pedido: já que o Gemini está instável agora, otimizar o motor local (Ollama) pra responder mais rápido e mais natural — sem depender da nuvem.

**Achado novo que muda o diagnóstico de lentidão:** a máquina é um MacBook Air **M1 com 8GB de RAM total**, sem GPU discreta. O `llama3.1:8b` quantizado (Q4_K_M) já ocupa **4.9GB só de peso** — num total de 8GB compartilhado com todo o resto do macOS, Chrome e os processos Node do próprio app, isso é pressão de memória severa. É uma causa mais provável pra lentidão de até 90s (Fase 02/08) do que "falta de GPU" como o `HISTORICO.md` vinha assumindo — o Ollama no Apple Silicon já usa a GPU integrada (Metal) por padrão. Confirmei também com `ollama ps` que o modelo nem está carregado na memória agora (foi descarregado por inatividade) — a próxima mensagem vai pagar o custo de carregar os 4.9GB de novo, antes mesmo de começar a gerar.

**Plano, em sub-fases — velocidade:**

1. **Testar um modelo menor** — `llama3.2:3b` ou `qwen2.5:3b-instruct` (bom suporte a português) no lugar do 8B. Em Q4, ocupam ~2GB — cabem com folga nos 8GB de RAM dessa máquina, sem a pressão de memória que o 8B causa. Deve ganhar velocidade principalmente por isso, não só por ter menos parâmetros. Testar a qualidade da correção gramatical e a disciplina de aspas antes de trocar como padrão — se cair demais, considerar um meio-termo (`phi3.5:3.8b`).
2. **Manter o modelo "quente" (`keep_alive`)** — o Ollama descarrega o modelo depois de alguns minutos sem uso (confirmado agora com `ollama ps` vazio); a próxima mensagem depois de uma pausa paga o carregamento inteiro de novo. Passar `keep_alive: "15m"` na chamada evita isso pro padrão de uso de um app de conversação (mensagens espaçadas).
3. **Limitar o tamanho da resposta (`num_predict`)** — hoje não há limite; um cap de ~150-200 tokens evita o modelo divagar além do necessário pra uma correção + frase de prática, economizando tempo de geração e de TTS depois.
4. **Reduzir o histórico enviado (`HISTORY_LIMIT`, hoje 20)** — cada mensagem extra no histórico é processamento de prompt antes de começar a gerar. Testar se 8-10 mensagens bastam sem perda perceptível de contexto da conversa.
5. **Medir antes/depois de cada mudança** — mesmo método usado no teste do Gemini (tempo de resposta via `curl`), não assumir que uma mudança ajudou sem medir.

**Plano, em sub-fases — naturalidade:**

6. **Parar de forçar uma frase entre aspas em TODA resposta** — hoje o prompt (`BASE_PROMPT`) exige exatamente uma frase em inglês entre aspas em toda resposta, mesmo quando o aluno não cometeu erro nenhum. Isso faz a conversa parecer um exercício de repetição forçado, não um bate-papo — um professor de verdade não manda repetir uma frase depois de cada coisa que você diz. Mudar a regra: só gerar a frase de prática quando houver uma correção real; sem erro, o agente responde livre em português, sem aspas. Bônus: menos respostas com aspas = menos trocas de voz na fala (reforça o que a Fase 10 já mitigou).
7. **Variar a abertura das correções** — os testes desta sessão mostraram a mesma frase ("Não acredito! Você fez o mesmo erro novamente!") aparecendo quase toda vez — soa como um template fixo, não uma reação de verdade. Dar ao modelo um leque de reações no prompt, ou pedir explicitamente pra variar a abertura.
8. **Respostas mais curtas por padrão** — pedir 1-2 frases de explicação, não um parágrafo — mais parecido com bate-papo real, e de bônus ajuda a velocidade (menos tokens pra gerar e sintetizar).
9. **Few-shot no prompt** — 1-2 exemplos curtos de pergunta→resposta ideal direto no `BASE_PROMPT` (aspas só quando há erro, resposta curta, tom variado) — modelos pequenos seguem exemplo concreto melhor que instrução abstrata, o que ajuda tanto o 8B atual quanto um modelo menor se o item 1 for adotado.
10. **Re-medir a disciplina de aspas** — repetir o teste desta sessão (mandar um erro de propósito, contar pares de aspas) depois dessas mudanças, pra confirmar que melhorou de verdade.

**Riscos a monitorar:**
- Modelo menor pode piorar a qualidade da correção gramatical ou o português — testar antes de trocar como padrão.
- `keep_alive` alto mantém RAM ocupada o tempo todo mesmo sem uso — numa máquina de 8GB isso pode deixar outros apps lentos entre conversas; usar um valor moderado (10-15 min), não infinito.
- Histórico menor pode fazer o agente "esquecer" contexto em conversas longas — testar com 15+ mensagens antes de confirmar que 8-10 basta.

**Próximo passo:** sub-fase 1 (testar modelo menor) e sub-fase 6 (parar de forçar aspas em toda resposta) são as de maior impacto — uma ataca velocidade na raiz (pressão de memória), a outra ataca naturalidade na raiz (estrutura de drill forçado). Recomendo começar por essas duas antes das demais.

### 2026-10-28 — Fase 12 executada: velocidade de até 90s pra menos de 2s

- **Modelo trocado:** `llama3.1:8b` → `qwen2.5:3b-instruct`. Testei dois candidatos de 3B (`llama3.2:3b` e `qwen2.5:3b-instruct`) com frases de erro que **não** estavam no few-shot do prompt ("Yesterday I go to the beach", "I am agree with you") — o `llama3.2:3b` não pegou nenhuma das duas, o `qwen2.5:3b-instruct` pegou uma. Nenhum é perfeito, mas o `qwen2.5` foi melhor nessa amostra pequena e igualmente rápido — virou o padrão.
- **`keep_alive: "15m"`** e **`num_predict: 220`** adicionados na chamada ao Ollama (`agent.ts`); **`HISTORY_LIMIT`** de 20 → 10 mensagens (`server.ts`).
- **Prompt reescrito (`BASE_PROMPT`/`MODE_PROMPT`):** só gera a frase entre aspas quando há uma correção de verdade — antes, toda resposta (mesmo "oi, tudo bem?") vinha com uma frase pra repetir, o que soava como um exercício forçado. Também pedi pra variar a abertura das correções (antes repetia "Não acredito! Você fez o mesmo erro de novo!" quase sempre) e respostas mais curtas (1-2 frases), com dois exemplos few-shot direto no prompt.
- **Medido via `/api/chat` real (não só a chamada crua ao Ollama), com histórico de conversa limpo:**
  - Mensagem com erro óbvio ("I has two cats"): **1.66s** de ponta a ponta (mood + geração + segmentação + streak), aspas única, frase certa.
  - Mensagem sem erro ("What did you do this weekend?"): **0.76s**, sem aspas nenhuma, resposta natural em português.
  - Antes desta fase: até 90s por resposta (Fase 02/08) com o `llama3.1:8b`.
- **Causa raiz confirmada:** a máquina é um MacBook Air M1 com só 8GB de RAM — o 8B em Q4 ocupava 4.9GB só de peso, pressão de memória severa. Um modelo de ~2GB cabe com folga, e combinado com `keep_alive` manter o modelo carregado entre mensagens, o ganho foi muito maior do que "menos parâmetros" sozinho explicaria.
- **Bug real encontrado e corrigido durante o teste:** a tabela `messages` estava poluída com dezenas de mensagens dos meus próprios testes de API nesta sessão — isso inflava a contagem de mensagens do usuário e empurrava o `mood` pra "no_limite" sem motivo real, e numa chamada chegou a fazer o modelo citar a frase **errada** como "frase de prática" (confusão de contexto, não bug de código). Pedi autorização e limpei a tabela `messages` (não afeta streak, progresso de lições nem a lista de erros revisados, que vivem em tabelas separadas) antes de medir de novo — os números acima já são com o histórico limpo.
- **Risco real, não resolvido, registrado como limitação conhecida:** a mudança de "só corrigir quando há erro" (pedida pra soar mais natural) depende do modelo *perceber* o erro — e nos testes, tanto o `llama3.2:3b` quanto o `qwen2.5:3b` **deixaram passar erros reais** de vez em quando (ex. "I am agree with you", sujeito+verbo errado, não foi corrigido por nenhum dos dois na minha amostra). O prompt antigo (forçava uma correção em toda resposta) evitava esse "erro passa batido" à força, mas custava a sensação de bate-papo real que motivou essa fase. Isso é uma troca pedagógica de verdade — vale observar no uso real se o aluno sente que erros estão passando sem correção, e se vale a pena reconsiderar.

### 2026-10-30 — Fase 13: acessibilidade (ARIA) e indicador de "falando"

Pedido: o usuário trouxe um plano externo genérico (nomeando o app "Moddi") propondo reescrever boa parte da arquitetura — prompt LLM em JSON estrito, `llama3.1:8b`, SSE no Fastify, processo Piper residente com lock, schema EdTech completo. Comparando com o código real, quase tudo já existe no Papo Reto, implementado de forma diferente e já validada por medição nas Fases 05-12 (ver decisões acima) — reescrever jogaria fora esses ajustes. O único gap real do plano externo era acessibilidade: `App.tsx` não tinha nenhuma marcação ARIA.

**Feito (`frontend/src/App.tsx`, `frontend/src/App.css`):**
- `.messages` ganhou `role="log" aria-live="polite"` — novas mensagens do agente são anunciadas sem interromper o usuário.
- Região `role="status" aria-live="assertive"` (visualmente oculta via nova classe `.sr-only`) refletindo o estado atual: "Ouvindo...", "Papo Reto está pensando...", "Papo Reto está falando...".
- Novo estado `isSpeaking`, setado em torno de `speakSegments` — faltava um indicador de "falando" mesmo na UX visual (só "ouvindo" e "digitando" existiam antes). Reflete também numa classe `.speaking` no `.stage`, com animação sutil (`prefers-reduced-motion` respeitado).
- Erros de microfone e de engine (`micError`, `engineNotice`) agora são `role="alert"`, antes eram `<p>` silenciosos pra leitor de tela.
- Botão de falar ganhou `aria-pressed={listening}`.

**Descartado do plano externo, intencionalmente:** prompt JSON/CoT (reverteria a Fase 12), modelo 8B de volta (reintroduz lentidão), SSE no lugar do NDJSON (mesmo efeito, troca sem ganho), processo Piper residente com lock (o cache em disco já resolve o custo de repetição sem a complexidade de gerenciar um processo compartilhado), schema EdTech completo (o schema atual já é suficiente pra um app single-user local).

**Verificação:** `npx tsc -b` limpo no frontend. Validação visual no navegador não foi possível nesta sessão (extensão Claude-in-Chrome desconectada) — fica pendente testar manualmente a árvore de acessibilidade e o ciclo ouvindo/pensando/falando num dev server (`npx vite --port 5174` já deixado rodando).

### 2026-10-30 — Fase 14: redesign visual "neon noturno"

Pedido: aplicar um mockup de design visual (fundo midnight blue/charcoal, acentos indigo e emerald glowing, bolhas translúcidas, waveform no mic) trazido pelo usuário. Duas decisões precisavam de confirmação antes de mexer, porque o mockup não resolvia: (1) o app era **light-only por decisão explícita da Fase 04** — virar dark-only é reverter essa decisão, não só "adicionar" um tema; (2) o "waveform" do mockup parecia reagir ao volume real da voz, o que exigiria capturar áudio via Web Audio API além do que o `SpeechRecognition` já usa. Perguntei ao usuário: escolheu **dark-only** (não um toggle claro/escuro) e **waveform decorativo** (não reativo ao volume real).

**Feito:**
- **`frontend/src/index.css`:** tokens de cor trocados pra dark — `--bg-gradient` (midnight blue → charcoal), `--brand` agora é indigo (`#5C6BC0`, antes era verde), `--success` (emerald `#00C853`) entra como cor nova pra correção/acerto, `--danger`/`--danger-strong` separados (um pra texto sobre fundo escuro, outro pra fundo sólido com texto branco). `color-scheme: dark`.
- **Cuidado de contraste (as mesmas regras ARIA da Fase 13 não podiam regredir):** `--brand-dark` (indigo escuro) era usado em alguns lugares como *cor de texto* no tema claro antigo — em cima de fundo escuro isso ficava ilegível (texto escuro em fundo escuro). Criei `--brand-light` pra esses casos (contraste ~6.9:1) e troquei nos 4 pontos que usavam `--brand-dark` como texto (`tabs button.active`, `settings-group button.picked`, `.stat-value`, `.trilha .tag`) — `--brand-dark` continua existindo, mas só pra fundo de hover (texto branco em cima, contraste ~7.5:1). Confirmei por cálculo de luminância relativa (fórmula WCAG) que texto branco sobre `--danger` (vermelho claro) não batia 4.5:1 — daí o `--danger-strong`, mais escuro, só pro botão de mic gravando.
- **`frontend/src/App.tsx` / `App.css`:** o indicador de estado (ouvindo/pensando/falando) da Fase 13 virou **visível** (antes só existia pra leitor de tela, `sr-only`) — texto com glow (vermelho ouvindo, emerald falando), ainda `role="status" aria-live="assertive"`, dentro do `.stage`, acima do botão de mic, como pedia o mockup; continua anunciado por leitor de tela, não é um elemento novo além do que a Fase 13 já tinha, só deixou de estar escondido.
- **Waveform decorativo** (`.waveform`, 5 barras com `scaleY` animado) aparece embaixo do mic enquanto ouvindo (vermelho) ou falando (emerald) — `aria-hidden`, puramente visual, não lê volume real (decisão acima).
- **Cartão de correção:** a frase de prática (texto entre aspas) agora é destacada dentro da bolha com um `<span className="practice-phrase">` (borda e glow emerald) em vez de se perder no meio do texto em português — reusa a mesma lógica de achar a frase entre aspas que o backend já usa em `extractPracticePhrase`/`splitSpeechSegments`, só que no cliente e só pra estilo.
- Bolhas (`.bubble.user`/`.bubble.agent`), avatar (`Avatar.tsx`) e confete (`Confetti.tsx`) recoloridos pra combinar com a paleta nova.
- **Não usei fonte do Google** (Inter via CDN) — ficaria em desacordo com o princípio de "100% local" do projeto (ver README). Mantido o stack de fontes do sistema, que já lista "Inter" como fallback.

**Verificação:** `npx tsc -b` limpo. Validação visual automatizada não foi possível (extensão Claude-in-Chrome desconectada nas duas sessões) — fica pendente confirmar visualmente que o contraste calculado bate com a leitura real da tela e que as animações respeitam `prefers-reduced-motion`. Rebuild de produção feito (`npm run build`) e o `vite preview --port 5173` (o mesmo que `start.command`/o atalho do Desktop abre) foi reiniciado com o build novo — confirmado via `curl` que o CSS servido já tem a paleta escura (`#0f172a`). O dev server de teste da Fase 13/14 (`--port 5174`) foi encerrado, não fica mais rodando à parte.

**Próximo passo:** usar o app normalmente por alguns dias com o motor Ollama/qwen2.5 e observar dois pontos: (1) se a velocidade se mantém boa fora de testes isolados, com conversas mais longas; (2) se a taxa de "erros que passam batido" (risco acima) incomoda na prática — se incomodar, dá pra reavaliar entre voltar a forçar correção sempre (mais chato, mas não deixa passar nada) ou aceitar que, como numa conversa real, nem todo erro vira correção na hora.
