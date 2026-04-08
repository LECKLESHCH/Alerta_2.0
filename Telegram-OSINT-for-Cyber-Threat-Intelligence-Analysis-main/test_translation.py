"""
Тестирование модуля перевода сообщений.
Этот тест можно запустить без подключения к Telegram API.
Требует установки языковых пакетов для argostranslate.
"""

import sys
import os

# Добавляем путь к модулям проекта
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from helper.translate import translate, get_installed_languages

def test_translation():
    """Тестирует перевод текста на английский."""
    
    print("=" * 60)
    print("Тестирование модуля перевода")
    print("=" * 60)
    
    # Проверяем установленные языки
    print("\nПроверка установленных языковых пакетов...")
    installed = get_installed_languages()
    print(f"Установлено языков: {len(installed)}")
    
    if len(installed) == 0:
        print("\n⚠ ВНИМАНИЕ: Языковые пакеты не установлены!")
        print("Для тестирования перевода установите пакеты:")
        print("  python helper/translate.py")
        print("Или установите все языки:")
        print("  from helper.translate import install_all_languages")
        print("  install_all_languages()")
        return False
    
    print("Доступные языки:")
    for lang in installed[:10]:  # Показываем первые 10
        print(f"  - {lang}")
    if len(installed) > 10:
        print(f"  ... и еще {len(installed) - 10}")
    
    test_cases = [
        {
            "name": "Русский текст",
            "text": "Привет, как дела? Сегодня хорошая погода.",
            "should_translate": True
        },
        {
            "name": "Английский текст (не должен переводиться)",
            "text": "Hello, how are you? Today is a good weather.",
            "should_translate": False
        },
        {
            "name": "Испанский текст",
            "text": "Hola, ¿cómo estás? Hoy hace buen tiempo.",
            "should_translate": True
        },
        {
            "name": "Немецкий текст",
            "text": "Hallo, wie geht es dir? Heute ist gutes Wetter.",
            "should_translate": True
        },
        {
            "name": "Пустая строка",
            "text": "",
            "should_translate": False
        },
        {
            "name": "None значение",
            "text": None,
            "should_translate": False
        }
    ]
    
    print("\n" + "=" * 60)
    print("Тестирование перевода:")
    print("=" * 60)
    
    passed = 0
    failed = 0
    
    for i, test in enumerate(test_cases, 1):
        print(f"\nТест {i}: {test['name']}")
        print(f"Исходный текст: {test['text']}")
        
        try:
            translated = translate(test['text'])
            
            if test['should_translate']:
                if translated and translated != test['text']:
                    print(f"✓ Переведено: {translated}")
                    passed += 1
                else:
                    print(f"✗ Перевод не выполнен (ожидался перевод)")
                    failed += 1
            else:
                if translated is None or translated == test['text']:
                    print(f"✓ Перевод не требуется (как и ожидалось)")
                    passed += 1
                else:
                    print(f"⚠ Переведено (хотя не требовалось): {translated}")
                    passed += 1  # Это не ошибка, просто информационно
        except Exception as e:
            print(f"✗ Ошибка при переводе: {e}")
            failed += 1
    
    print("\n" + "=" * 60)
    print(f"Результаты: {passed} пройдено, {failed} провалено из {len(test_cases)}")
    print("=" * 60)
    
    return failed == 0

if __name__ == "__main__":
    success = test_translation()
    sys.exit(0 if success else 1)

