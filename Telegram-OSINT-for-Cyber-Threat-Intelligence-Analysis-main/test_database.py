"""
Тестирование модуля работы с базой данных SQLite.
Этот тест можно запустить без подключения к Telegram API.
"""

import sys
import os
import sqlite3

# Добавляем путь к модулям проекта
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from helper.db import (
    start_database,
    messages_collection_get_offset_id,
    messages_collection_insert_offset_id,
    iocs_batch_insert
)

def test_database():
    """Тестирует работу с базой данных."""
    
    print("=" * 60)
    print("Тестирование модуля базы данных")
    print("=" * 60)
    
    # Создаем тестовую базу данных
    test_db_name = "test_app.db"
    original_db_name = None
    
    try:
        # Сохраняем оригинальное имя БД
        from helper import db
        original_db_name = db.sqlite_db_name
        db.sqlite_db_name = test_db_name
        
        # Удаляем тестовую БД если существует
        if os.path.exists(test_db_name):
            os.remove(test_db_name)
        
        print("\n1. Создание базы данных и таблиц...")
        start_database()
        
        if os.path.exists(test_db_name):
            print("✓ База данных создана успешно")
        else:
            print("✗ База данных не создана")
            return False
        
        # Проверяем наличие таблиц
        conn = sqlite3.connect(test_db_name)
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = [row[0] for row in cursor.fetchall()]
        conn.close()
        
        expected_tables = ["Messages_collection", "IOCs"]
        if all(table in tables for table in expected_tables):
            print(f"✓ Таблицы созданы: {', '.join(tables)}")
        else:
            print(f"✗ Не все таблицы созданы. Ожидалось: {expected_tables}, получено: {tables}")
            return False
        
        print("\n2. Тестирование работы с offset ID...")
        test_entity_id = 12345
        
        # Получаем offset ID (должен быть 0 для нового entity)
        offset = messages_collection_get_offset_id(test_entity_id)
        if offset == 0:
            print(f"✓ Начальный offset ID получен: {offset}")
        else:
            print(f"⚠ Неожиданный offset ID: {offset} (ожидалось 0)")
        
        # Вставляем offset ID
        import time
        start_time = int(time.time())
        end_time = start_time + 100
        
        messages_collection_insert_offset_id(
            test_entity_id,
            0,  # start_offset_id
            500,  # last_offset_id
            start_time,
            end_time
        )
        print("✓ Offset ID вставлен")
        
        # Получаем offset ID снова (должен быть 500)
        offset = messages_collection_get_offset_id(test_entity_id)
        if offset == 500:
            print(f"✓ Offset ID получен после вставки: {offset}")
        else:
            print(f"✗ Неожиданный offset ID: {offset} (ожидалось 500)")
            return False
        
        print("\n3. Тестирование batch вставки IOCs...")
        test_iocs = [
            {
                "message_id": 1,
                "entity_id": test_entity_id,
                "from_id": {"user_id": 100},
                "ioc_type": "IPv4",
                "ioc_value": "192.168.1.1",
                "original_message": "IP адрес: 192.168.1.1",
                "translated_message": "IP address: 192.168.1.1"
            },
            {
                "message_id": 2,
                "entity_id": test_entity_id,
                "from_id": {"user_id": 101},
                "ioc_type": "URL",
                "ioc_value": "https://example.com",
                "original_message": "Сайт: https://example.com",
                "translated_message": "Site: https://example.com"
            }
        ]
        
        iocs_batch_insert(test_iocs)
        print(f"✓ Вставлено {len(test_iocs)} IOCs")
        
        # Проверяем, что IOCs действительно вставлены
        conn = sqlite3.connect(test_db_name)
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM IOCs")
        count = cursor.fetchone()[0]
        conn.close()
        
        if count == len(test_iocs):
            print(f"✓ Проверка: в базе {count} IOCs")
        else:
            print(f"✗ Неожиданное количество IOCs: {count} (ожидалось {len(test_iocs)})")
            return False
        
        print("\n" + "=" * 60)
        print("✓ Все тесты базы данных пройдены успешно!")
        print("=" * 60)
        
        return True
        
    except Exception as e:
        print(f"\n✗ Ошибка при тестировании: {e}")
        import traceback
        traceback.print_exc()
        return False
        
    finally:
        # Восстанавливаем оригинальное имя БД
        if original_db_name:
            from helper import db
            db.sqlite_db_name = original_db_name
        
        # Удаляем тестовую БД
        if os.path.exists(test_db_name):
            try:
                os.remove(test_db_name)
                print(f"\n✓ Тестовая база данных {test_db_name} удалена")
            except:
                pass

if __name__ == "__main__":
    success = test_database()
    sys.exit(0 if success else 1)

