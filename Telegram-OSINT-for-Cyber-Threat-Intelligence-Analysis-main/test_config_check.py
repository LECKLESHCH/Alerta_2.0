"""
Проверка наличия и корректности файла конфигурации configs.py.
"""

import sys
import os

def check_config():
    """Проверяет наличие и корректность configs.py."""
    
    print("=" * 60)
    print("Проверка конфигурации")
    print("=" * 60)
    
    config_path = os.path.join(os.path.dirname(__file__), "configs.py")
    
    # Проверяем наличие файла
    if not os.path.exists(config_path):
        print("\n✗ Файл configs.py не найден!")
        print("\nСоздайте файл configs.py на основе example_configs.py:")
        print("  cp example_configs.py configs.py")
        print("\nЗатем отредактируйте configs.py и укажите:")
        print("  - PHONE_NUMBER: ваш номер телефона Telegram")
        print("  - API_ID: ваш API ID из https://my.telegram.org")
        print("  - API_HASH: ваш API Hash из https://my.telegram.org")
        print("  - PROXIES: (опционально) список прокси")
        print("  - es_username, es_password, es_ca_cert_path: (опционально) для Elasticsearch")
        return False
    
    print("✓ Файл configs.py найден")
    
    # Пытаемся импортировать конфигурацию
    try:
        sys.path.insert(0, os.path.dirname(config_path))
        import configs
        
        print("\nПроверка обязательных параметров:")
        
        required_params = {
            "PHONE_NUMBER": str,
            "API_ID": int,
            "API_HASH": str
        }
        
        all_ok = True
        for param, param_type in required_params.items():
            value = getattr(configs, param, None)
            if value is None:
                print(f"✗ {param}: не установлен (должен быть {param_type.__name__})")
                all_ok = False
            elif not isinstance(value, param_type):
                print(f"✗ {param}: неверный тип (получен {type(value).__name__}, ожидается {param_type.__name__})")
                all_ok = False
            else:
                # Маскируем чувствительные данные при выводе
                if param == "API_HASH":
                    display_value = value[:8] + "..." if len(value) > 8 else "***"
                elif param == "PHONE_NUMBER":
                    display_value = value[:3] + "***" + value[-2:] if len(value) > 5 else "***"
                else:
                    display_value = str(value)
                print(f"✓ {param}: {display_value}")
        
        # Проверяем опциональные параметры
        print("\nПроверка опциональных параметров:")
        
        optional_params = {
            "PROXIES": "список прокси (может быть None)",
            "es_username": "имя пользователя Elasticsearch (может быть None)",
            "es_password": "пароль Elasticsearch (может быть None)",
            "es_ca_cert_path": "путь к сертификату Elasticsearch (может быть None)"
        }
        
        for param, description in optional_params.items():
            value = getattr(configs, param, None)
            if value is None:
                print(f"○ {param}: не установлен ({description})")
            else:
                print(f"✓ {param}: установлен")
        
        if all_ok:
            print("\n" + "=" * 60)
            print("✓ Конфигурация корректна!")
            print("=" * 60)
            return True
        else:
            print("\n" + "=" * 60)
            print("✗ Конфигурация требует исправления")
            print("=" * 60)
            return False
            
    except ImportError as e:
        print(f"\n✗ Ошибка импорта configs.py: {e}")
        return False
    except Exception as e:
        print(f"\n✗ Ошибка при проверке конфигурации: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = check_config()
    sys.exit(0 if success else 1)

