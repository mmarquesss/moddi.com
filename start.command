#!/bin/bash
# Caminho fixo (não dirname "$0") porque este script também vive como atalho
# no Desktop, numa pasta diferente da do projeto.
cd /Users/marlonmarques/moddi/moddi.com

echo "Papo Reto"
echo "---------"

if ! curl -s http://localhost:11434 > /dev/null; then
  echo "Iniciando Ollama..."
  brew services start ollama > /dev/null 2>&1
  sleep 2
fi

if ! curl -s http://localhost:3001/api/health > /dev/null; then
  echo "Iniciando backend..."
  (cd backend && nohup npm run dev > /tmp/papo-reto-backend.log 2>&1 &)
fi

if ! curl -s http://localhost:5173 > /dev/null; then
  echo "Build do frontend (produção, mais rápido que o modo dev)..."
  (cd frontend && npm run build > /tmp/papo-reto-build.log 2>&1)
  echo "Iniciando frontend..."
  (cd frontend && nohup npx vite preview --port 5173 --strictPort > /tmp/papo-reto-frontend.log 2>&1 &)
fi

echo "Esperando o app ficar pronto..."
for i in $(seq 1 30); do
  if curl -s http://localhost:5173 > /dev/null; then
    break
  fi
  sleep 1
done

echo "Abrindo o Papo Reto..."
open http://localhost:5173

sleep 2
