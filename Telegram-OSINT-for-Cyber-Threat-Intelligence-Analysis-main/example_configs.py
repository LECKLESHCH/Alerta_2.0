"""
Example configs.py file with all configurations enabled and filled in with dummy values.
"""

# Telegram collection configs
PHONE_NUMBER: str = "+10000000000"
API_HASH: str = "your_telegram_api_hash_here"
API_ID: int = 123456

# Proxy configs (3 proxies configured)
PROXIES: list[dict] = [
    {
        "proxy_type": "socks5",
        "addr": "123.123.123.123",
        "port": 1080,
        "username": "user",
        "password": "whatintheworld",
        "rdns": True,
    },
    {
        "proxy_type": "socks5",
        "addr": "123.123.123.124",
        "port": 1080,
        "username": "user",
        "password": "whatintheworld",
        "rdns": True,
    },
    {
        "proxy_type": "socks5",
        "addr": "123.123.123.125",
        "port": 1080,
        "username": "user",
        "password": "whatintheworld",
        "rdns": True,
    },
]

# Elastic configs (local Elasticsearch Windows installation)
es_username: str = "elastic"
es_password: str = "change_me"
es_ca_cert_path: str = "/path/to/elasticsearch/http_ca.crt"
