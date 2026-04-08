"""
Тестирование модуля извлечения IOCs (Indicators of Compromise).
Этот тест можно запустить без подключения к Telegram API.
"""

import sys
import os

# Добавляем путь к модулям проекта
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from helper.ioc import find_iocs, IOC

def test_ioc_extraction():
    """Тестирует извлечение различных типов IOCs."""
    
    print("=" * 60)
    print("Тестирование извлечения IOCs")
    print("=" * 60)
    
    test_cases = [
        {
            "name": "IPv4 адрес",
            "text": "Подключитесь к серверу по адресу 192.168.1.100",
            "expected": ["IPv4"]
        },
        {
            "name": "URL и домен",
            "text": "Посетите https://example.com или example.org",
            "expected": ["URL", "Domain"]
        },
        {
            "name": "Хеши (MD5, SHA1, SHA256)",
            "text": "MD5: 5d41402abc4b2a76b9719d911017c592 SHA1: da39a3ee5e6b4b0d3255bfef95601890afd80709 SHA256: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            "expected": ["MD5", "SHA1", "SHA256"]
        },
        {
            "name": "CVE идентификатор",
            "text": "Уязвимость CVE-2024-21410 была исправлена",
            "expected": ["CVE"]
        },
        {
            "name": "Email адрес",
            "text": "Свяжитесь с нами: contact@example.com",
            "expected": ["Email"]
        },
        {
            "name": "Bitcoin адрес",
            "text": "Отправьте платеж на 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
            "expected": ["Bitcoin"]
        },
        {
            "name": "Ethereum адрес",
            "text": "Кошелек: 0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
            "expected": ["Ethereum"]
        },
        {
            "name": "Комплексный пример",
            "text": "Атака на 192.168.1.1 через CVE-2024-12345. Хеш: 5d41402abc4b2a76b9719d911017c592. Сайт: https://malicious.com",
            "expected": ["IPv4", "CVE", "MD5", "URL"]
        },
        {
            "name": "Текст без IOCs",
            "text": "Привет, как дела? Сегодня хорошая погода.",
            "expected": []
        }
    ]
    
    passed = 0
    failed = 0
    
    for i, test in enumerate(test_cases, 1):
        print(f"\nТест {i}: {test['name']}")
        print(f"Текст: {test['text']}")
        
        iocs_found = find_iocs(test['text'])
        found_types = [ioc[0] for ioc in iocs_found]
        
        print(f"Найдено IOCs: {found_types}")
        print(f"Ожидалось: {test['expected']}")
        
        # Проверяем, что найдены все ожидаемые типы
        expected_found = all(expected_type in found_types for expected_type in test['expected'])
        
        if expected_found:
            print("✓ Тест пройден")
            passed += 1
        else:
            print("✗ Тест провален")
            failed += 1
        
        # Выводим детали найденных IOCs
        if iocs_found:
            print("Детали:")
            for ioc_type, ioc_value in iocs_found:
                print(f"  - {ioc_type}: {ioc_value}")
    
    print("\n" + "=" * 60)
    print(f"Результаты: {passed} пройдено, {failed} провалено из {len(test_cases)}")
    print("=" * 60)
    
    return failed == 0

if __name__ == "__main__":
    success = test_ioc_extraction()
    sys.exit(0 if success else 1)

