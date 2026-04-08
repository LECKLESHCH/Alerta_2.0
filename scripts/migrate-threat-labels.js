const categoryMap = {
  Malware: 'Вредоносное ПО',
  Phishing: 'Фишинг',
  'Vulnerabilities & Exploits': 'Уязвимости и эксплуатация',
  'Data Breach': 'Утечки данных',
  'Network Attacks': 'Сетевые атаки',
  'Supply Chain': 'Атаки на цепочку поставок',
  APT: 'APT-активность',
  Fraud: 'Мошенничество',
  'Cloud Security': 'Облачная безопасность',
  'Physical-Cyber/ICS': 'Промышленные и киберфизические атаки',
};

const subMap = {
  ransomware: 'Программа-вымогатель',
  spyware: 'Шпионское ПО',
  trojan: 'Троян',
  botnet: 'Ботнет',
  phishing: 'Фишинговая рассылка',
  'spear-phishing': 'Целевой фишинг',
  smishing: 'Смишинг',
  vishing: 'Вишинг',
  impersonation: 'Имперсонация',
  'zero-day': 'Уязвимость нулевого дня',
  'CVE disclosure': 'Публикация CVE',
  'exploit in the wild': 'Эксплуатация в реальной среде',
  misconfiguration: 'Небезопасная конфигурация',
  leaks: 'Утечка',
  dumps: 'Слив баз данных',
  'credential exposure': 'Компрометация учётных данных',
  'insider leaks': 'Внутренняя утечка',
  DDoS: 'DDoS-атака',
  'BGP hijacking': 'Перехват BGP',
  'DNS attacks': 'DNS-атака',
  'scanning campaigns': 'Кампания сканирования',
  'compromised dependencies': 'Скомпрометированные зависимости',
  'poisoned updates': 'Отравленные обновления',
  'third-party breach': 'Компрометация подрядчика',
  espionage: 'Кибершпионаж',
  sabotage: 'Саботаж',
  'influence operations': 'Операции влияния',
  'cyber warfare': 'Кибервойна',
  'payment fraud': 'Платёжное мошенничество',
  'crypto scams': 'Криптомошенничество',
  'account takeover': 'Захват учётной записи',
  'IAM abuse': 'Злоупотребление IAM',
  'cloud misconfig': 'Небезопасная облачная конфигурация',
  'token leakage': 'Утечка токенов',
  SCADA: 'SCADA-инцидент',
  'critical infrastructure': 'Критическая инфраструктура',
  'industrial incidents': 'Промышленный инцидент',
};

const docs = db.articles.find({}, { _id: 1, category: 1, subcategory: 1 }).toArray();
let updated = 0;

for (const doc of docs) {
  const nextCategory = categoryMap[doc.category] || doc.category;
  const nextSubcategory = subMap[doc.subcategory] || doc.subcategory;

  if (nextCategory !== doc.category || nextSubcategory !== doc.subcategory) {
    db.articles.updateOne(
      { _id: doc._id },
      { $set: { category: nextCategory, subcategory: nextSubcategory } },
    );
    updated += 1;
  }
}

printjson({ total: docs.length, updated });
