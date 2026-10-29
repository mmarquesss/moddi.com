// Service worker mínimo, só pra satisfazer o critério de instalação de PWA do navegador.
// Não faz cache nem funciona offline — o app depende do backend + Ollama locais de qualquer forma.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", () => self.clients.claim());
self.addEventListener("fetch", () => {});
