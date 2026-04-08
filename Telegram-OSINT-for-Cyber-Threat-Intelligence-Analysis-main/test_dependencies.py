"""
Скрипт для проверки установленных зависимостей проекта.
Запустите этот скрипт перед началом тестирования.
"""

import sys

def check_dependency(module_name, package_name=None):
    """Проверяет, установлен ли модуль."""
    if package_name is None:
        package_name = module_name
    
    try:
        __import__(module_name)
        print(f"✓ {package_name} установлен")
        return True
    except ImportError:
        print(f"✗ {package_name} НЕ установлен")
        print(f"  Установите: pip install {package_name}")
        return False

def main():
    print("=" * 60)
    print("Проверка зависимостей проекта")
    print("=" * 60)
    
    dependencies = [
        ("telethon", "Telethon"),
        ("argostranslate", "argostranslate"),
        ("lingua", "lingua-language-detector"),
        ("elasticsearch", "elasticsearch"),
        ("ijson", "ijson"),
        ("requests", "requests"),
    ]
    
    results = []
    for module, package in dependencies:
        results.append(check_dependency(module, package))
    
    print("\n" + "=" * 60)
    if all(results):
        print("✓ Все зависимости установлены!")
        print("Можно переходить к тестированию функциональности.")
    else:
        print("✗ Некоторые зависимости отсутствуют.")
        print("Установите недостающие пакеты командой:")
        print("  pip install -r requirements.txt")
    print("=" * 60)
    
    return all(results)

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)

