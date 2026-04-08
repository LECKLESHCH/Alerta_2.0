const CATEGORY_LABELS = {
  ransomware: 'Программы-вымогатели',
  malware: 'Вредоносное ПО',
  spyware: 'Шпионское ПО',
  botnet: 'Ботнеты',
  phishing: 'Фишинг',
  scam: 'Мошенничество',
  fraud: 'Фрод',
  ddos: 'DDoS',
  apt: 'APT-активность',
  exploit: 'Эксплуатация уязвимостей',
  vulnerability: 'Уязвимости',
  zero_day: 'Уязвимости нулевого дня',
  'zero-day': 'Уязвимости нулевого дня',
  supply_chain: 'Атаки на цепочку поставок',
  'supply-chain': 'Атаки на цепочку поставок',
  credential_attack: 'Компрометация учётных данных',
  'credential-theft': 'Кража учётных данных',
  'credential theft': 'Кража учётных данных',
  data_breach: 'Утечки данных',
  'data-breach': 'Утечки данных',
  leak: 'Утечки данных',
  web_attack: 'Веб-атаки',
  'web-attack': 'Веб-атаки',
  network_attack: 'Сетевые атаки',
  'network-attack': 'Сетевые атаки',
  insider_threat: 'Внутренние угрозы',
  'insider-threat': 'Внутренние угрозы',
  cyber_espionage: 'Кибершпионаж',
  'cyber-espionage': 'Кибершпионаж',
  disinformation: 'Дезинформация',
  industrial_attack: 'Атаки на промышленный контур',
  'industrial-attack': 'Атаки на промышленный контур',
  iot_attack: 'Атаки на IoT',
  'iot-attack': 'Атаки на IoT',
  mobile_threat: 'Мобильные угрозы',
  'mobile-threat': 'Мобильные угрозы',
};

const SUBCATEGORY_LABELS = {
  remote_code_execution: 'Удалённое выполнение кода',
  'remote-code-execution': 'Удалённое выполнение кода',
  rce: 'Удалённое выполнение кода',
  privilege_escalation: 'Повышение привилегий',
  'privilege-escalation': 'Повышение привилегий',
  lateral_movement: 'Латеральное перемещение',
  'lateral-movement': 'Латеральное перемещение',
  initial_access: 'Первичный доступ',
  'initial-access': 'Первичный доступ',
  persistence: 'Закрепление',
  defense_evasion: 'Обход средств защиты',
  'defense-evasion': 'Обход средств защиты',
  command_and_control: 'Командование и управление',
  'command-and-control': 'Командование и управление',
  c2: 'Командование и управление',
  data_exfiltration: 'Экcфильтрация данных',
  'data-exfiltration': 'Экcфильтрация данных',
  credential_dumping: 'Выгрузка учётных данных',
  'credential-dumping': 'Выгрузка учётных данных',
  phishing_email: 'Фишинговое письмо',
  'phishing-email': 'Фишинговое письмо',
  spear_phishing: 'Целевой фишинг',
  'spear-phishing': 'Целевой фишинг',
  sql_injection: 'SQL-инъекция',
  'sql-injection': 'SQL-инъекция',
  xss: 'Межсайтовый скриптинг',
  watering_hole: 'Watering hole',
  'watering-hole': 'Watering hole',
  supply_chain_compromise: 'Компрометация цепочки поставок',
  'supply-chain-compromise': 'Компрометация цепочки поставок',
  encryption: 'Шифрование данных',
  wiper: 'Уничтожение данных',
  defacement: 'Дефейс',
  brute_force: 'Перебор паролей',
  'brute-force': 'Перебор паролей',
};

function prettifyThreatLabel(value) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return '';
  }

  return normalized
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^\w/u, (letter) => letter.toUpperCase());
}

function translateFromMap(value, map, fallback = 'Не указано') {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }

  return map[normalized] || prettifyThreatLabel(value);
}

export function getThreatCategoryLabel(value, fallback = 'Не указана') {
  return translateFromMap(value, CATEGORY_LABELS, fallback);
}

export function getThreatSubcategoryLabel(value, fallback = 'Не указана') {
  return translateFromMap(value, SUBCATEGORY_LABELS, fallback);
}
