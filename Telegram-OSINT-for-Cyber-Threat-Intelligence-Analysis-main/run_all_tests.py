"""
Запуск всех тестов проекта.
Этот скрипт последовательно запускает все тесты.
"""

import sys
import subprocess
import os

def run_test(test_file, description):
    """Запускает тест и возвращает результат."""
    print("\n" + "=" * 60)
    print(f"Запуск: {description}")
    print("=" * 60)
    
    try:
        result = subprocess.run(
            [sys.executable, test_file],
            capture_output=False,
            text=True
        )
        return result.returncode == 0
    except Exception as e:
        print(f"Ошибка при запуске теста: {e}")
        return False

def main():
    """Запускает все тесты последовательно."""
    
    print("=" * 60)
    print("Запуск всех тестов проекта")
    print("=" * 60)
    
    tests = [
        ("test_dependencies.py", "Проверка зависимостей"),
        ("test_config_check.py", "Проверка конфигурации"),
        ("test_database.py", "Тестирование базы данных"),
        ("test_ioc_extraction.py", "Тестирование извлечения IOCs"),
        ("test_translation.py", "Тестирование перевода"),
    ]
    
    results = {}
    
    for test_file, description in tests:
        if os.path.exists(test_file):
            results[test_file] = run_test(test_file, description)
        else:
            print(f"\n⚠ Файл {test_file} не найден, пропускаем")
            results[test_file] = None
    
    # Итоговый отчет
    print("\n" + "=" * 60)
    print("ИТОГОВЫЙ ОТЧЕТ")
    print("=" * 60)
    
    passed = sum(1 for r in results.values() if r is True)
    failed = sum(1 for r in results.values() if r is False)
    skipped = sum(1 for r in results.values() if r is None)
    
    for test_file, result in results.items():
        if result is True:
            status = "✓ ПРОЙДЕН"
        elif result is False:
            status = "✗ ПРОВАЛЕН"
        else:
            status = "○ ПРОПУЩЕН"
        print(f"{status}: {test_file}")
    
    print("\n" + "=" * 60)
    print(f"Всего: {len(results)} тестов")
    print(f"Пройдено: {passed}")
    print(f"Провалено: {failed}")
    print(f"Пропущено: {skipped}")
    print("=" * 60)
    
    if failed > 0:
        print("\n⚠ Некоторые тесты провалены. Проверьте вывод выше.")
        return False
    elif passed == 0:
        print("\n⚠ Нет пройденных тестов.")
        return False
    else:
        print("\n✓ Все тесты пройдены успешно!")
        return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)

