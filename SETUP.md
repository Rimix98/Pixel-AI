# Pixel AI — Настройка

## 1. Установка

```bash
npm install
```

## 2. Переменные окружения

```bash
cp .env.example .env.local
```

Заполни `.env.local`:

```
JWT_SECRET=<сгенерируй длинную строку>
OLLAMA_URL=https://ollama.com/v1
OLLAMA_API_KEY=<твой ключ Ollama>
NEXT_PUBLIC_BASE_URL=http://localhost:3000
TON_WALLET_ADDRESS=<адрес TON-кошелька>
TON_PRO_AMOUNT=0.4
TON_MAX_AMOUNT=0.8
TAVILY_API_KEY=<опционально, для поиска>
```

## 3. Запуск

```bash
npm run dev
```

Открой http://localhost:3000

База данных (`pixel-ai.db`) создаётся автоматически при первом запросе.

## 4. Деплой

См. [README.md](README.md#деплой-на-vercel)
