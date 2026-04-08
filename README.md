# ALERTA 2.0

ALERTA 2.0 — система для сбора, классификации и отображения материалов по кибербезопасности.

Проект состоит из:
- `backend` — API на `NestJS`, краулер источников, классификация и сохранение данных
- `frontend` — веб-интерфейс на `React`
- `docker` — локальная инфраструктура для `MongoDB` и `Qdrant`

## Нормальный локальный запуск

Теперь у проекта есть единый контракт запуска, как это обычно делается в рабочих командах:

```bash
nvm use
make bootstrap
make dev
```

После этого сервисы доступны по адресам:
- backend: `http://127.0.0.1:3000`
- frontend: `http://127.0.0.1:3001`

Остановить всё:

```bash
make stop
make infra-down
```

## Что важно перед первым запуском

- использовать `Node.js 20.20.2`
- иметь установленный `nvm`
- иметь запущенный `Docker Desktop`

Версия Node зафиксирована в [.nvmrc](/Users/lecklesh/Documents/VNO/ALERTA_2.0/.nvmrc).

## Команды проекта

Основные команды лежат в [Makefile](/Users/lecklesh/Documents/VNO/ALERTA_2.0/Makefile).

### 1. Подготовить окружение

```bash
make bootstrap
```

Что делает команда:
- переключает проект на `Node 20.20.2`
- ставит зависимости backend
- ставит зависимости frontend
- поднимает `MongoDB` и `Qdrant`
- проверяет окружение

### 2. Проверить окружение

```bash
make check
```

Проверяются:
- версия `Node`
- наличие `backend/.env`
- доступность `MongoDB`
- доступность `Qdrant`
- занятость портов `3000` и `3001`

### 3. Поднять инфраструктуру

```bash
make infra-up
```

Остановить инфраструктуру:

```bash
make infra-down
```

### 4. Запустить проект

```bash
make dev
```

Эта команда:
- проверяет окружение
- при необходимости поднимает Docker-инфраструктуру
- запускает backend в фоне
- запускает frontend в фоне
- пишет логи в `.run/`

Логи:
- `.run/backend.log`
- `.run/frontend.log`

### 5. Запускать сервисы по отдельности

Backend:

```bash
make dev-backend
```

Frontend:

```bash
make dev-frontend
```

### 6. Остановить локальные процессы

```bash
make stop
```

Команда останавливает процессы на портах `3000` и `3001`, а также использует pid-файлы из `.run/`.

### 7. Полная локальная очистка

```bash
make clean
```

Команда:
- останавливает backend и frontend
- останавливает Docker-инфраструктуру

### 8. Переустановить зависимости с нуля

```bash
make reset-deps
```

Использовать, если локальные `node_modules` снова повреждены.

## Почему это лучше ручного запуска

Так обычно и делают в реальных командах:
- фиксируют версию runtime
- сводят запуск к нескольким стандартным командам
- отделяют `bootstrap` от `run`
- добавляют preflight-проверки
- держат инфраструктуру в `docker compose`
- делают понятный сценарий остановки и восстановления

То есть запуск проекта больше не должен зависеть от того, помнишь ли ты правильный набор команд и флагов.

## Структура проекта

```text
ALERTA_2.0/
├── backend/
├── frontend/
├── docker/
├── scripts/
├── Makefile
├── .nvmrc
└── README.md
```

## Инфраструктура

`docker compose` теперь поднимает:
- `MongoDB`
- `Qdrant`

Конфиг лежит в [docker-compose.yml](/Users/lecklesh/Documents/VNO/ALERTA_2.0/docker/docker-compose.yml).

## Backend

Точка входа:
- [main.ts](/Users/lecklesh/Documents/VNO/ALERTA_2.0/backend/src/main.ts)

Основные эндпоинты:
- `GET /articles`
- `GET /crawl/all`
- `GET /crawl/article?url=...&source=...`
- `GET /threat-predictor/predict/:articleId`

Список источников:
- [sources.json](/Users/lecklesh/Documents/VNO/ALERTA_2.0/backend/src/crawler/sources.json)

Логика краулера:
- [crawler.service.ts](/Users/lecklesh/Documents/VNO/ALERTA_2.0/backend/src/crawler/crawler.service.ts)

## Frontend

Frontend работает на старом `react-scripts`, поэтому при запуске могут быть warnings от `Sass` и `Bootstrap`. Это не блокирует работу, но это технический долг, который потом стоит отдельно почистить.

## Переменные окружения backend

Если `backend/.env` отсутствует, он создаётся автоматически из [backend/.env.example](/Users/lecklesh/Documents/VNO/ALERTA_2.0/backend/.env.example).

Минимально важные переменные:
- `OPENAI_API_KEY`
- `QDRANT_URL`
- `MONGODB_URI` или `MONGO_URI`
- `CRAWLER_DISABLE_LLM`
- `CRAWLER_DISABLE_EMBEDDINGS`
- `CRAWLER_CONCURRENCY`
- `CRAWLER_SOURCE_CONCURRENCY`

## Типовой рабочий сценарий

```bash
nvm use
make bootstrap
make dev
curl http://127.0.0.1:3000/crawl/all
```

Потом смотреть статьи:

```bash
curl http://127.0.0.1:3000/articles
```

## Если что-то сломалось

Базовая последовательность восстановления:

```bash
make stop
make infra-down
make reset-deps
make bootstrap
make dev
```

Если проблема не ушла, первым делом смотри:
- `.run/backend.log`
- `.run/frontend.log`
