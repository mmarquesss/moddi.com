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
