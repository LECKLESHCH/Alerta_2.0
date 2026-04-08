# Быстрое тестирование проекта

## Минимальные тесты (без Telegram API)

Эти тесты можно запустить сразу, без настройки Telegram API:

### 1. Проверка зависимостей
```bash
python test_dependencies.py
```

### 2. Тест извлечения IOCs
```bash
python test_ioc_extraction.py
```

### 3. Тест базы данных
```bash
python test_database.py
```

### 4. Запуск всех автономных тестов
```bash
python run_all_tests.py
```

## Тесты с Telegram API

⚠️ **Требуют настройки configs.py**

### 1. Проверка конфигурации
```bash
# Сначала создайте configs.py
cp example_configs.py configs.py
# Отредактируйте configs.py с вашими данными

# Затем проверьте
python test_config_check.py
```

### 2. Тест сбора метаданных (безопасно)
```bash
python scrape.py --get-entities
```

### 3. Тест сбора сообщений (ограниченно)
```bash
# Собрать только 500 сообщений из одного чата
python scrape.py --get-messages 500 --max-entities 1
```

## Полное руководство

См. `TESTING_GUIDE.md` для подробной информации.

