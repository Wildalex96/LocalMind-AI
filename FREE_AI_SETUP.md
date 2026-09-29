# Бесплатные AI в LocalMind

## Полностью бесплатно и без API-ключей

### LM Studio
1. Установите LM Studio.
2. Загрузите совместимую instruct-модель.
3. Запустите Local Server на `127.0.0.1:1234`.
4. В LocalMind выберите `LM Studio` или `Бесплатные автоматически`.

LocalMind использует OpenAI-compatible endpoint LM Studio.

### Ollama
1. Установите Ollama.
2. LocalMind автоматически обнаруживает Ollama и при необходимости запускает его.
3. В режиме `Бесплатные автоматически` Ollama используется как локальный fallback.

## Бесплатные облачные варианты

### Gemini Free Tier
Создайте API key в Google AI Studio: https://aistudio.google.com/apikey
Добавьте `GEMINI_API_KEY` в окружение процесса LocalMind.

### Groq Free Tier
Создайте ключ: https://console.groq.com/keys
Добавьте `GROQ_API_KEY`.

### OpenRouter Free
Создайте ключ: https://openrouter.ai/settings/keys
Установите `OPENROUTER_MODEL=openrouter/free`.
Бесплатный тариф OpenRouter имеет ограничения по запросам; LocalMind использует его только как fallback.

## Порядок free-auto

`LM Studio → Ollama → Gemini → Groq → OpenRouter`

Если провайдер недоступен или возвращает ошибку, LocalMind автоматически пробует следующий.

## Безопасность

- Реальные ключи не должны попадать в Git.
- Не вставляйте ключи в исходники.
- Не добавляйте `.env` в commit.
- Платные OpenAI/Claude не используются в `free-auto`.

## Ограничения

Бесплатные облачные тарифы имеют rate limits и могут изменяться провайдером. Поэтому для полностью независимой работы используйте LM Studio/Ollama.
