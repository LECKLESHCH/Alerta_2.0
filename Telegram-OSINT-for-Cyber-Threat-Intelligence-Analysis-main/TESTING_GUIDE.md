# Руководство по тестированию проекта

Это руководство поможет вам протестировать работу проекта Telegram OSINT для анализа киберугроз.

## Шаг 1: Проверка зависимостей

Перед началом тестирования убедитесь, что все зависимости установлены:

```bash
# Установка зависимостей
pip install -r requirements.txt

# Проверка установленных зависимостей
python test_dependencies.py
```

## Шаг 2: Настройка конфигурации

Создайте файл `configs.py` на основе `example_configs.py`:

```bash
cp example_configs.py configs.py
```

Отредактируйте `configs.py` и укажите:
- `PHONE_NUMBER`: ваш номер телефона Telegram (например, "+1234567890")
- `API_ID`: ваш API ID из https://my.telegram.org
- `API_HASH`: ваш API Hash из https://my.telegram.org
- `PROXIES`: (опционально) список прокси для анонимности
- `es_username`, `es_password`, `es_ca_cert_path`: (опционально) для Elasticsearch

Проверьте конфигурацию:

```bash
python test_config_check.py
```

## Шаг 3: Тестирование отдельных модулей

### 3.1. Тестирование извлечения IOCs

Этот тест не требует подключения к Telegram API:

```bash
python test_ioc_extraction.py
```

Тест проверяет извлечение различных типов IOCs:
- IPv4/IPv6 адреса
- URL и домены
- Хеши (MD5, SHA1, SHA256)
- CVE идентификаторы
- Email адреса
- Криптовалютные адреса

### 3.2. Тестирование перевода

Этот тест не требует подключения к Telegram API, но требует установки языковых пакетов:

```bash
python test_translation.py
```

Если языковые пакеты не установлены, вы можете установить их:

```python
from helper.translate import install_all_languages
install_all_languages()
```

Или установить конкретные языки:

```python
from helper.translate import install_language
install_language("ru")  # Русский -> Английский
install_language("es")  # Испанский -> Английский
```

### 3.3. Тестирование базы данных

Этот тест не требует подключения к Telegram API:

```bash
python test_database.py
```

Тест проверяет:
- Создание базы данных и таблиц
- Работу с offset ID для инкрементального сбора
- Batch вставку IOCs

## Шаг 4: Запуск всех тестов

Запустите все тесты последовательно:

```bash
python run_all_tests.py
```

## Шаг 5: Тестирование с реальным Telegram API

⚠️ **ВНИМАНИЕ**: Следующие тесты требуют реального подключения к Telegram API и могут собирать реальные данные.

### 5.1. Тестирование сбора метаданных сущностей

Соберите метаданные всех ваших чатов (без сообщений):

```bash
python scrape.py --get-entities
```

Это безопасный тест, который только собирает информацию о структуре ваших чатов.

### 5.2. Тестирование сбора сообщений (ограниченное)

Соберите небольшое количество сообщений из одного чата:

```bash
# Собрать 500 сообщений из конкретного чата (замените <entity_id> на ID чата)
python scrape.py --get-messages 500 --entities <entity_id>

# Или собрать из всех чатов с ограничением
python scrape.py --get-messages 500 --max-entities 1
```

### 5.3. Тестирование сбора участников

Соберите участников из небольшой группы:

```bash
python scrape.py --get-participants --entities <entity_id> --max-entities 1
```

### 5.4. Полный тест (с осторожностью)

Полный тест со всеми функциями (может занять много времени):

```bash
python scrape.py --get-entities --get-messages 1000 --get-participants --max-entities 1
```

## Шаг 6: Проверка результатов

После выполнения тестов проверьте:

1. **Логи**: Проверьте файлы логов в директории `output/`
2. **JSON файлы**: Проверьте собранные данные в `output/`
3. **База данных**: Проверьте файл `app.db` (если используется SQLite)
4. **Elasticsearch**: Если настроен, проверьте индексы в Kibana

## Устранение проблем

### Проблема: "ModuleNotFoundError"

**Решение**: Установите недостающие зависимости:
```bash
pip install -r requirements.txt
```

### Проблема: "configs.py не найден"

**Решение**: Создайте файл конфигурации:
```bash
cp example_configs.py configs.py
# Отредактируйте configs.py
```

### Проблема: "Telegram API ошибка"

**Решение**: 
- Проверьте правильность API_ID и API_HASH
- Убедитесь, что номер телефона подтвержден в Telegram
- Проверьте интернет-соединение
- Попробуйте использовать прокси (если доступ заблокирован)

### Проблема: "Ошибка перевода"

**Решение**: Установите языковые пакеты:
```python
from helper.translate import install_language
install_language("ru")  # для русского
```

### Проблема: "Elasticsearch ошибка"

**Решение**: 
- Убедитесь, что Elasticsearch запущен
- Проверьте правильность учетных данных в configs.py
- Проверьте путь к сертификату CA

## Рекомендации по безопасности

1. **Используйте burner номер**: Рекомендуется использовать отдельный номер телефона для тестирования
2. **Используйте VM**: Запускайте проект в виртуальной машине для изоляции
3. **Используйте прокси**: Настройте прокси для анонимности
4. **Ограничьте сбор**: Начните с малых объемов данных для тестирования
5. **Проверьте данные**: Убедитесь, что собранные данные не содержат чувствительной информации

## Дополнительные тесты

### Тест извлечения IOCs вручную

```python
from helper.ioc import find_iocs

text = "IP адрес: 192.168.1.1, сайт: https://example.com"
iocs = find_iocs(text)
print(iocs)
```

### Тест перевода вручную

```python
from helper.translate import translate

text = "Привет, как дела?"
translated = translate(text)
print(translated)
```

### Тест работы с базой данных вручную

```python
from helper.db import start_database, messages_collection_get_offset_id

start_database()
offset = messages_collection_get_offset_id(12345)
print(f"Offset ID: {offset}")
```

## Следующие шаги

После успешного тестирования вы можете:

1. Настроить автоматический сбор данных
2. Настроить экспорт в Elasticsearch для анализа
3. Настроить мониторинг конкретных каналов/групп
4. Создать дашборды в Kibana для визуализации данных

