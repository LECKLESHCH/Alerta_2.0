import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Article } from '../article/article.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { QdrantClient } from '@qdrant/js-client-rest';
import { OpenAIEmbeddings, ChatOpenAI } from '@langchain/openai';
import * as fs from 'fs';
import * as path from 'path';
import { chromium } from 'playwright'; // Импортируем Playwright
import { execFile } from 'child_process';
import { promisify } from 'util';
import { ReferenceIntelService } from '../reference-intel/reference-intel.service';

const execFilePromise = promisify(execFile);

interface Source {
  name: string;
  url: string;
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSource(value: unknown): value is Source {
  return (
    isRecord(value) &&
    typeof value['name'] === 'string' &&
    typeof value['url'] === 'string'
  );
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function normalizeModelContent(content: unknown): string | null {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    const parts = content
      .map((p) => {
        if (typeof p === 'string') return p;
        if (!isRecord(p)) return '';
        const text = p['text'];
        return typeof text === 'string' ? text : '';
      })
      .filter(Boolean);
    if (parts.length > 0) return parts.join('\n');
  }
  if (isRecord(content)) {
    const text = content['text'];
    if (typeof text === 'string') return text;
  }
  return null;
}

function extractJsonObjectFromText(text: string): unknown {
  const direct = safeJsonParse(text);
  if (direct !== null) return direct;

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced && fenced[1]) {
    const parsed = safeJsonParse(fenced[1]);
    if (parsed !== null) return parsed;
  }

  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const candidate = text.slice(firstBrace, lastBrace + 1);
    const parsed = safeJsonParse(candidate);
    if (parsed !== null) return parsed;
  }

  return null;
}

function normalizeNullableString(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.toLowerCase() === 'null') return null;
  return value;
}

function normalizeCountryName(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return 'Global';
  const lower = trimmed.toLowerCase();

  if (lower === 'global') return 'Global';

  const usaSet = new Set(['usa', 'us', 'u.s.', 'u.s', 'united states']);
  if (usaSet.has(lower)) return 'United States';

  const russiaSet = new Set([
    'russia',
    'rf',
    'russian federation',
    'россия',
    'рф',
  ]);
  if (russiaSet.has(lower)) return 'Russia';

  const ukraineSet = new Set(['ukraine', 'ua', 'украина']);
  if (ukraineSet.has(lower)) return 'Ukraine';

  const iranSet = new Set(['iran', 'иран']);
  if (iranSet.has(lower)) return 'Iran';

  return trimmed;
}

function inferCountryFromContext(input: {
  url: string;
  sourceName: string;
  title: string;
  text: string;
  current: string;
}): string {
  const combined = `${input.title}\n${input.text}`.toLowerCase();
  const normalizedCurrent = normalizeCountryName(input.current);

  const russiaSignals = [
    'генштаб',
    'минобороны',
    'росси',
    'рф',
    'москва',
    'санкт-петербург',
    'сбер',
    'втб',
    'госуслуг',
    'роскомнадзор',
    'фсб',
    'мвд',
  ];
  if (russiaSignals.some((s) => combined.includes(s))) return 'Russia';

  const usaSignals = [
    'fbi',
    'united states',
    'u.s.',
    'usa',
    'америк',
    'сша',
    'вашингтон',
    'пентагон',
    'cia',
    'nsa',
    'google',
    'microsoft',
    'alphabet',
    'silicon valley',
    'california',
    'калифорн',
  ];
  if (usaSignals.some((s) => combined.includes(s))) return 'United States';

  const ukraineSignals = ['украин', 'киев', 'сбу'];
  if (ukraineSignals.some((s) => combined.includes(s))) return 'Ukraine';

  const iranSignals = ['иран', 'iran', 'проиран'];
  if (iranSignals.some((s) => combined.includes(s))) return 'Iran';

  if (normalizedCurrent !== 'Global') return normalizedCurrent;

  const hostname = (() => {
    try {
      return new URL(input.url).hostname.toLowerCase();
    } catch {
      return '';
    }
  })();

  if (hostname.endsWith('.ru')) return 'Russia';

  const sourceLower = input.sourceName.toLowerCase();
  if (
    sourceLower.includes('kommersant') ||
    sourceLower.includes('securitylab') ||
    sourceLower.includes('anti-malware') ||
    sourceLower.includes('infowatch') ||
    sourceLower.includes('cisoclub')
  ) {
    return 'Russia';
  }

  return 'Global';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout<T>(
  operation: () => Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  if (!(ms > 0)) return operation();

  let timer: NodeJS.Timeout | null = null;
  try {
    return await Promise.race([
      operation(),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`${label} timed out after ${ms}ms`));
        }, ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  const size = Math.max(1, Math.min(concurrency, items.length || 1));
  let index = 0;

  const runners = Array.from({ length: size }, async () => {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      await worker(current);
    }
  });

  await Promise.all(runners);
}

function shouldRetryClassificationError(message: string): boolean {
  const msg = message.toLowerCase();
  if (msg.includes('402')) return false;
  if (msg.includes('empty model content')) return true;
  if (msg.includes('invalid json')) return true;
  if (msg.includes('rate limit') || msg.includes('429')) return true;
  if (msg.includes('timeout') || msg.includes('timed out')) return true;
  if (msg.includes('502') || msg.includes('503') || msg.includes('504'))
    return true;
  return false;
}

const CATEGORY_EN_TO_RU: Record<string, string> = {
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

const CATEGORY_RU_TO_EN: Record<string, string> = Object.entries(
  CATEGORY_EN_TO_RU,
).reduce((acc, [en, ru]) => {
  acc[ru.toLowerCase()] = en;
  return acc;
}, {} as Record<string, string>);

const SUBCATEGORY_EN_TO_RU: Record<string, string> = {
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

function normalizeCategoryToCanonicalEnglish(
  category: string | null,
): string | null {
  if (!category) return null;
  const normalized = category.trim();
  if (!normalized) return null;

  if (CATEGORY_EN_TO_RU[normalized]) return normalized;

  const lower = normalized.toLowerCase();
  if (CATEGORY_RU_TO_EN[lower]) return CATEGORY_RU_TO_EN[lower];

  for (const [ru, en] of Object.entries(CATEGORY_RU_TO_EN)) {
    if (lower.includes(ru)) return en;
  }

  return normalized;
}

function normalizeSubcategoryToCanonicalEnglish(
  category: string | null,
  subcategory: string | null,
): string | null {
  if (!subcategory) return null;
  const trimmed = subcategory.trim();
  if (!trimmed) return null;

  if (SUBCATEGORY_EN_TO_RU[trimmed]) return trimmed;

  const lower = trimmed.toLowerCase();
  const ruToEn = Object.entries(SUBCATEGORY_EN_TO_RU).reduce(
    (acc, [en, ru]) => {
      acc[ru.toLowerCase()] = en;
      return acc;
    },
    {} as Record<string, string>,
  );

  if (ruToEn[lower]) return ruToEn[lower];

  const categorySpecific = normalizeSubcategoryForCategory(category, trimmed);
  if (categorySpecific) return categorySpecific;

  for (const [ru, en] of Object.entries(ruToEn)) {
    if (lower.includes(ru)) return en;
  }

  return trimmed;
}

function translateCategoryToRussian(category: string | null): string | null {
  if (!category) return null;
  return CATEGORY_EN_TO_RU[category] ?? category;
}

function translateSubcategoryToRussian(
  subcategory: string | null,
): string | null {
  if (!subcategory) return null;
  return SUBCATEGORY_EN_TO_RU[subcategory] ?? subcategory;
}

function normalizeSubcategoryForCategory(
  category: string | null,
  subcategory: string | null,
): string | null {
  if (!category || !subcategory) return null;

  const sub = subcategory.trim();
  if (!sub) return null;

  const lower = sub.toLowerCase();

  const map: Record<string, Array<[string, string]>> = {
    Malware: [
      ['ransom', 'ransomware'],
      ['spy', 'spyware'],
      ['trojan', 'trojan'],
      ['botnet', 'botnet'],
    ],
    Phishing: [
      ['spear', 'spear-phishing'],
      ['smish', 'smishing'],
      ['vish', 'vishing'],
      ['imperson', 'impersonation'],
      ['phish', 'phishing'],
    ],
    'Vulnerabilities & Exploits': [
      ['zero', 'zero-day'],
      ['0-day', 'zero-day'],
      ['cve', 'CVE disclosure'],
      ['in the wild', 'exploit in the wild'],
      ['misconfig', 'misconfiguration'],
    ],
    'Data Breach': [
      ['credential', 'credential exposure'],
      ['dump', 'dumps'],
      ['insider', 'insider leaks'],
      ['leak', 'leaks'],
    ],
    'Network Attacks': [
      ['ddos', 'DDoS'],
      ['bgp', 'BGP hijacking'],
      ['dns', 'DNS attacks'],
      ['scan', 'scanning campaigns'],
    ],
    'Supply Chain': [
      ['depend', 'compromised dependencies'],
      ['poison', 'poisoned updates'],
      ['third', 'third-party breach'],
    ],
    APT: [
      ['espion', 'espionage'],
      ['sabot', 'sabotage'],
      ['influence', 'influence operations'],
      ['war', 'cyber warfare'],
    ],
    Fraud: [
      ['payment', 'payment fraud'],
      ['crypto', 'crypto scams'],
      ['account takeover', 'account takeover'],
    ],
    'Cloud Security': [
      ['iam', 'IAM abuse'],
      ['token', 'token leakage'],
      ['misconfig', 'cloud misconfig'],
    ],
    'Physical-Cyber/ICS': [
      ['scada', 'SCADA'],
      ['critical', 'critical infrastructure'],
      ['industrial', 'industrial incidents'],
    ],
  };

  const rules = map[category];
  if (rules) {
    for (const [needle, canonical] of rules) {
      if (lower.includes(needle)) return canonical;
    }
  }

  return null;
}

type Score01 = number;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function normalizeScore01(value: unknown): Score01 {
  if (typeof value === 'number') {
    return Number(clamp01(value).toFixed(3));
  }

  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) return 0.0;
    if (trimmed === 'none' || trimmed === 'нет' || trimmed === 'no') return 0.0;
    if (trimmed === 'low' || trimmed === 'низк' || trimmed === 'small')
      return 0.25;
    if (trimmed === 'medium' || trimmed === 'средн') return 0.55;
    if (trimmed === 'high' || trimmed === 'высок') return 0.85;
    if (trimmed === 'max' || trimmed === 'maximum') return 1.0;
    const n = Number(trimmed);
    if (Number.isFinite(n)) return normalizeScore01(n);
  }

  return 0.0;
}

function normalizeBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (!v) return false;
    if (['true', 'yes', 'y', '1', 'да', 'истина'].includes(v)) return true;
    if (['false', 'no', 'n', '0', 'нет', 'ложь'].includes(v)) return false;
  }
  return false;
}

type TargetSector = 'energy' | 'finance' | 'gov' | 'generic';
type AttackVector = 'network' | 'local' | 'adjacent' | 'physical';

interface ThreatMetricsResult {
  target_sector: TargetSector;
  sub_sector: string | null;
  attack_scale: Score01;
  region: string | null;

  attack_vector: AttackVector;
  exposure_required: boolean;
  user_interaction: boolean;

  complexity: Score01;
  exploit_available: Score01;
  privileges_required: Score01;

  impact_confidentiality: Score01;
  impact_integrity: Score01;
  impact_availability: Score01;

  active_exploitation: boolean;
  time_to_exploit: Score01;

  llm_confidence: Score01;
  extracted_at: string;
}

interface InterpretationSignalsResult {
  cve_mentions: string[];
  vendor_candidates: string[];
  product_candidates: string[];
  technology_terms: string[];
  attack_techniques: string[];
  asset_type: string | null;
  threat_actor: string | null;
  malware_family: string | null;
  evidence_tokens: string[];
  interpretation_summary: string;
}

function normalizeStringArray(value: unknown, limit = 8): string[] {
  if (!Array.isArray(value)) return [];

  const out = new Set<string>();
  value.forEach((item) => {
    if (typeof item !== 'string') return;
    const trimmed = item.trim();
    if (!trimmed) return;
    out.add(trimmed);
  });

  return [...out].slice(0, limit);
}

function normalizeOptionalString(value: unknown): string | null {
  return typeof value === 'string' ? normalizeNullableString(value) : null;
}

function extractCveIds(text: string): string[] {
  return Array.from(
    new Set(
      [...text.matchAll(/\bCVE-\d{4}-\d{4,7}\b/gi)].map((match) =>
        match[0].toUpperCase(),
      ),
    ),
  ).slice(0, 8);
}

function extractDomainLikeEntities(text: string): string[] {
  return Array.from(
    new Set(
      [...text.matchAll(/\b[A-Za-z][A-Za-z0-9_-]*\.[A-Za-z][A-Za-z0-9.-]*\b/g)]
        .map((match) => match[0])
        .slice(0, 8),
    ),
  );
}

function extractBrandLikeEntities(text: string): string[] {
  const stopwords = new Set([
    'CVE',
    'HTTP',
    'URL',
    'JSON',
    'API',
    'News',
    'Times',
    'Industry',
    'Corporation',
    'China',
    'Russia',
    'Ukraine',
    'World',
    'Bug',
    'Bounty',
    'Positive',
  ]);
  return Array.from(
    new Set(
      [...text.matchAll(/\b[A-Z][A-Za-z0-9.+_-]{2,}\b/g)]
        .map((match) => match[0])
        .filter((item) => !stopwords.has(item)),
    ),
  ).slice(0, 8);
}

function collectKeywordHits(
  text: string,
  rules: Array<[string, string]>,
  limit = 8,
): string[] {
  const lower = text.toLowerCase();
  const out = new Set<string>();
  rules.forEach(([needle, label]) => {
    if (lower.includes(needle)) {
      out.add(label);
    }
  });
  return [...out].slice(0, limit);
}

function normalizeInterpretationSignals(
  raw: unknown,
  context: { title: string; text: string; category: string | null },
): InterpretationSignalsResult {
  const combinedText = `${context.title}\n${context.text}`;
  const heuristicVendors = Array.from(
    new Set([
      ...extractDomainLikeEntities(combinedText),
      ...extractBrandLikeEntities(combinedText),
    ]),
  ).slice(0, 8);
  const heuristicTechTerms = collectKeywordHits(
    combinedText,
    [
      ['vpn', 'VPN'],
      ['роутер', 'router'],
      ['маршрутиз', 'router'],
      ['сервер', 'server'],
      ['портал', 'web portal'],
      ['веб', 'web application'],
      ['брауз', 'browser'],
      ['scada', 'SCADA'],
      ['кии', 'critical infrastructure'],
      ['active directory', 'Active Directory'],
      ['directory', 'Active Directory'],
      ['iam', 'IAM'],
      ['token', 'token'],
      ['credential', 'credential'],
      ['учетн', 'credential'],
      ['почт', 'email'],
      ['email', 'email'],
      ['api', 'API'],
      ['cloud', 'cloud'],
      ['облач', 'cloud'],
      ['database', 'database'],
      ['баз дан', 'database'],
      ['router', 'router'],
      ['firewall', 'firewall'],
      ['межсет', 'firewall'],
      ['exchange', 'Exchange'],
    ],
    10,
  );
  const heuristicTechniques = collectKeywordHits(
    combinedText,
    [
      ['remote code execution', 'remote code execution'],
      ['rce', 'remote code execution'],
      ['phishing', 'phishing email'],
      ['фишинг', 'phishing email'],
      ['credential', 'credential theft'],
      ['утеч', 'data exfiltration'],
      ['leak', 'data exfiltration'],
      ['ddos', 'ddos'],
      ['ransom', 'ransomware deployment'],
      ['шифроваль', 'ransomware deployment'],
      ['token', 'token leakage'],
      ['supply chain', 'supply chain compromise'],
      ['подрядчик', 'third-party compromise'],
      ['эксплуатац', 'exploit in the wild'],
      ['взлом', 'unauthorized access'],
      ['компрометац', 'compromise'],
      ['0-day', 'zero-day exploitation'],
      ['zero-day', 'zero-day exploitation'],
    ],
    8,
  );
  const heuristicEvidence = collectKeywordHits(
    combinedText,
    [
      ['cve-', 'cve'],
      ['rce', 'rce'],
      ['фишинг', 'phishing'],
      ['credential', 'credential'],
      ['утеч', 'data leak'],
      ['ddos', 'ddos'],
      ['ransom', 'ransomware'],
      ['token', 'token'],
      ['iam', 'iam'],
      ['scada', 'scada'],
      ['роутер', 'router'],
      ['маршрутиз', 'router'],
      ['почт', 'email'],
    ],
    10,
  );

  const lowerCombined = combinedText.toLowerCase();
  const heuristicAssetType = (() => {
    if (lowerCombined.includes('scada') || lowerCombined.includes('асу'))
      return 'SCADA';
    if (
      lowerCombined.includes('роутер') ||
      lowerCombined.includes('маршрутиз') ||
      lowerCombined.includes('router')
    ) {
      return 'network appliance';
    }
    if (lowerCombined.includes('vpn')) return 'VPN';
    if (
      lowerCombined.includes('портал') ||
      lowerCombined.includes('веб') ||
      lowerCombined.includes('web')
    ) {
      return 'web application';
    }
    if (lowerCombined.includes('почт') || lowerCombined.includes('email'))
      return 'почта';
    if (lowerCombined.includes('баз дан') || lowerCombined.includes('database'))
      return 'database';
    if (lowerCombined.includes('сервер') || lowerCombined.includes('server'))
      return 'server';
    if (lowerCombined.includes('account') || lowerCombined.includes('учетн'))
      return 'account';
    return null;
  })();

  const heuristicSummary =
    context.category !== null
      ? `Интерпретация опирается на категорию ${context.category}.`
      : 'Интерпретация требует сопоставления с эталонной базой.';

  const base: InterpretationSignalsResult = {
    cve_mentions: extractCveIds(`${context.title}\n${context.text}`),
    vendor_candidates: heuristicVendors,
    product_candidates: heuristicVendors,
    technology_terms: heuristicTechTerms,
    attack_techniques: heuristicTechniques,
    asset_type: heuristicAssetType,
    threat_actor: null,
    malware_family: null,
    evidence_tokens: heuristicEvidence,
    interpretation_summary: heuristicSummary,
  };

  if (!isRecord(raw)) {
    return base;
  }

  return {
    cve_mentions: Array.from(
      new Set([
        ...base.cve_mentions,
        ...normalizeStringArray(raw['cve_mentions']).map((item) =>
          item.toUpperCase(),
        ),
      ]),
    ).slice(0, 8),
    vendor_candidates: Array.from(
      new Set([
        ...base.vendor_candidates,
        ...normalizeStringArray(raw['vendor_candidates']),
      ]),
    ).slice(0, 8),
    product_candidates: Array.from(
      new Set([
        ...base.product_candidates,
        ...normalizeStringArray(raw['product_candidates']),
      ]),
    ).slice(0, 8),
    technology_terms: Array.from(
      new Set([
        ...base.technology_terms,
        ...normalizeStringArray(raw['technology_terms'], 10),
      ]),
    ).slice(0, 10),
    attack_techniques: Array.from(
      new Set([
        ...base.attack_techniques,
        ...normalizeStringArray(raw['attack_techniques']),
      ]),
    ).slice(0, 8),
    asset_type: normalizeOptionalString(raw['asset_type']),
    threat_actor: normalizeOptionalString(raw['threat_actor']),
    malware_family: normalizeOptionalString(raw['malware_family']),
    evidence_tokens: Array.from(
      new Set([
        ...base.evidence_tokens,
        ...normalizeStringArray(raw['evidence_tokens'], 10),
      ]),
    ).slice(0, 10),
    interpretation_summary:
      normalizeOptionalString(raw['interpretation_summary']) ??
      base.interpretation_summary,
  };
}

function normalizeTargetSector(value: unknown): TargetSector {
  const v = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (
    v === 'energy' ||
    v.includes('энерг') ||
    v.includes('нефт') ||
    v.includes('газ') ||
    v.includes('electric') ||
    v.includes('power')
  ) {
    return 'energy';
  }
  if (
    v === 'finance' ||
    v.includes('финанс') ||
    v.includes('банк') ||
    v.includes('платеж') ||
    v.includes('payment')
  ) {
    return 'finance';
  }
  if (v === 'gov' || v === 'government' || v === 'гос' || v === 'власти')
    return 'gov';
  return 'generic';
}

function normalizeAttackVector(value: unknown): AttackVector {
  const v = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (v === 'local') return 'local';
  if (v === 'adjacent') return 'adjacent';
  if (v === 'physical') return 'physical';
  return 'network';
}

function normalizePrivilegesRequired(value: unknown): Score01 {
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (!v) return 0.55;
    if (v.includes('none') || v.includes('нет')) return 0.9;
    if (v.includes('user') || v.includes('польз')) return 0.55;
    if (v.includes('admin') || v.includes('root') || v.includes('админ'))
      return 0.25;
  }
  return normalizeScore01(value);
}

function normalizeExploitAvailable(value: unknown): Score01 {
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (!v) return 0.0;
    if (v.includes('нет') || v.includes('none') || v.includes('unknown'))
      return 0.0;
    if (v.includes('poc') || v.includes('proof')) return 0.65;
    if (
      v.includes('in the wild') ||
      v.includes('active') ||
      v.includes('актив')
    )
      return 0.9;
    if (v.includes('mass') || v.includes('массов')) return 1.0;
  }
  return normalizeScore01(value);
}

function ensureMinimumThreatScore(value: Score01): Score01 {
  return value === 0.0 ? 0.2 : value;
}

function normalizeThreatMetrics(
  raw: unknown,
  fallbackRegion: string,
  context: {
    isThreat: boolean;
    textSignals: string;
    inferredCountry: string;
  },
): ThreatMetricsResult {
  const nowIso = new Date().toISOString();
  const base: ThreatMetricsResult = {
    target_sector: 'generic',
    sub_sector: null,
    attack_scale: context.isThreat ? 0.24 : 0.0,
    region: fallbackRegion === 'Global' ? null : fallbackRegion,

    attack_vector: 'network',
    exposure_required: context.isThreat,
    user_interaction: false,

    complexity: 0.55,
    exploit_available: 0.0,
    privileges_required: 0.55,

    impact_confidentiality: context.isThreat ? 0.22 : 0.0,
    impact_integrity: context.isThreat ? 0.18 : 0.0,
    impact_availability: context.isThreat ? 0.2 : 0.0,

    active_exploitation: false,
    time_to_exploit: context.isThreat ? 0.55 : 0.0,

    llm_confidence: 0.5,
    extracted_at: nowIso,
  };

  if (!context.isThreat) {
    base.attack_scale = 0.0;
    base.attack_vector = 'network';
    base.exposure_required = false;
    base.user_interaction = false;
    base.complexity = 0.0;
    base.exploit_available = 0.0;
    base.privileges_required = 0.0;
    base.impact_confidentiality = 0.0;
    base.impact_integrity = 0.0;
    base.impact_availability = 0.0;
    base.active_exploitation = false;
    base.time_to_exploit = 0.0;
    base.llm_confidence = 0.0;
  }

  if (!isRecord(raw)) return base;

  const out: ThreatMetricsResult = { ...base };

  out.target_sector = normalizeTargetSector(raw['target_sector']);
  const subSector = raw['sub_sector'];
  out.sub_sector =
    typeof subSector === 'string' ? normalizeNullableString(subSector) : null;

  out.attack_scale = normalizeScore01(raw['attack_scale']);
  const region = raw['region'];
  if (typeof region === 'string') {
    const normalizedRegion = normalizeCountryName(region);
    out.region = normalizedRegion === 'Global' ? null : normalizedRegion;
  }

  out.attack_vector = normalizeAttackVector(raw['attack_vector']);
  out.exposure_required = normalizeBoolean(raw['exposure_required']);
  out.user_interaction = normalizeBoolean(raw['user_interaction']);

  out.complexity = normalizeScore01(raw['complexity']);
  out.exploit_available = normalizeExploitAvailable(raw['exploit_available']);
  out.privileges_required = normalizePrivilegesRequired(
    raw['privileges_required'],
  );

  out.impact_confidentiality = normalizeScore01(raw['impact_confidentiality']);
  out.impact_integrity = normalizeScore01(raw['impact_integrity']);
  out.impact_availability = normalizeScore01(raw['impact_availability']);

  out.active_exploitation = normalizeBoolean(raw['active_exploitation']);
  out.time_to_exploit = normalizeScore01(raw['time_to_exploit']);

  out.llm_confidence = normalizeScore01(raw['llm_confidence']);
  out.extracted_at = nowIso;

  if (!context.isThreat) {
    out.target_sector = 'generic';
    out.sub_sector = null;
    out.region = fallbackRegion === 'Global' ? null : fallbackRegion;
    out.attack_scale = 0.0;
    out.attack_vector = 'network';
    out.exploit_available = 0.0;
    out.time_to_exploit = 0.0;
    out.active_exploitation = false;
    out.exposure_required = false;
    out.user_interaction = false;
    out.complexity = 0.0;
    out.impact_confidentiality = 0.0;
    out.impact_integrity = 0.0;
    out.impact_availability = 0.0;
    out.privileges_required = 0.0;
    out.llm_confidence = 0.0;
    return out;
  }

  if (
    out.impact_confidentiality === 0.0 &&
    out.impact_integrity === 0.0 &&
    out.impact_availability === 0.0
  ) {
    out.impact_confidentiality = 0.22;
    out.impact_integrity = 0.18;
    out.impact_availability = 0.2;
  }

  if (out.time_to_exploit === 0.0) out.time_to_exploit = 0.55;

  if (out.active_exploitation && out.exploit_available < 0.9) {
    out.exploit_available = 0.9;
  }

  const s = context.textSignals;
  if (
    s.includes('утеч') ||
    s.includes('leak') ||
    s.includes('email') ||
    s.includes('почт')
  ) {
    out.impact_confidentiality = 0.9;
  }
  if (s.includes('ransom') || s.includes('вымог')) {
    out.impact_availability = 0.9;
  }
  if (s.includes('ddos')) {
    out.impact_availability = 0.9;
  }
  if (s.includes('tamper') || s.includes('integrity') || s.includes('подмен')) {
    out.impact_integrity = ensureMinimumThreatScore(out.impact_integrity);
  }

  if (out.target_sector === 'generic') {
    if (
      s.includes('fbi') ||
      s.includes('генштаб') ||
      s.includes('минобороны') ||
      s.includes('гос') ||
      s.includes('реестр') ||
      s.includes('ministry') ||
      s.includes('government')
    ) {
      out.target_sector = 'gov';
    } else if (
      s.includes('bank') ||
      s.includes('банк') ||
      s.includes('payment') ||
      s.includes('платеж')
    ) {
      out.target_sector = 'finance';
    } else if (
      s.includes('grid') ||
      s.includes('power') ||
      s.includes('energy') ||
      s.includes('энерг') ||
      s.includes('нефт') ||
      s.includes('газ')
    ) {
      out.target_sector = 'energy';
    }
  }

  if (out.region === null && context.inferredCountry !== 'Global') {
    out.region = context.inferredCountry;
  }

  return out;
}

interface ParsedArticleResult {
  title?: string;
  text?: string;
  publishedAt?: string | null;
  author?: string;
  url?: string;
  error?: string;
}

function isParsedArticleResult(value: unknown): value is ParsedArticleResult {
  if (!isRecord(value)) return false;

  const title = value['title'];
  const text = value['text'];
  const publishedAt = value['publishedAt'];
  const author = value['author'];
  const url = value['url'];
  const error = value['error'];

  return (
    (title === undefined || typeof title === 'string') &&
    (text === undefined || typeof text === 'string') &&
    (publishedAt === undefined ||
      publishedAt === null ||
      typeof publishedAt === 'string') &&
    (author === undefined || typeof author === 'string') &&
    (url === undefined || typeof url === 'string') &&
    (error === undefined || typeof error === 'string')
  );
}

type ClassificationType = 'news' | 'threat';
type ClassificationSeverity = 'high' | 'medium' | 'low' | null;

interface ClassificationResult {
  type: ClassificationType;
  category: string | null;
  subcategory: string | null;
  severity: ClassificationSeverity;
  country: string;
  vulnerability_type?: string | null;
  reasoning: string;
}

function isClassificationResult(value: unknown): value is ClassificationResult {
  if (!isRecord(value)) return false;

  const type = value['type'];
  const category = value['category'];
  const subcategory = value['subcategory'];
  const severity = value['severity'];
  const country = value['country'];
  const reasoning = value['reasoning'];

  return (
    (type === 'news' || type === 'threat') &&
    (category === null || typeof category === 'string') &&
    (subcategory === null || typeof subcategory === 'string') &&
    (severity === null ||
      severity === 'high' ||
      severity === 'medium' ||
      severity === 'low') &&
    typeof country === 'string' &&
    typeof reasoning === 'string'
  );
}

function hasAsciiWord(text: string, word: string): boolean {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(^|[^a-z])${escaped}([^a-z]|$)`, 'i');
  return regex.test(text);
}

function hasAny(text: string, signals: string[]): boolean {
  return signals.some((signal) => text.includes(signal));
}

function isCybersecurityRelevantArticle(title: string, text: string): boolean {
  const combined = `${title}\n${text}`.toLowerCase();
  const cyberSignals = [
    'кибер',
    'инфобез',
    'иб ',
    ' хакер',
    'хакер',
    'взлом',
    'утеч',
    'уязвим',
    'эксплойт',
    'вредонос',
    'шифроваль',
    'троян',
    'ботнет',
    'фишинг',
    'скимм',
    'ddos',
    'ransomware',
    'malware',
    'spyware',
    'trojan',
    'botnet',
    'phishing',
    'credential',
    'data breach',
    'zero-day',
    '0-day',
    'cve-',
    'infosec',
    'cyber',
    'supply chain',
    'apt',
    'компрометац',
    'кибератак',
    'киберугроз',
    'безопасност',
  ];

  return cyberSignals.some((signal) => combined.includes(signal));
}

function pickSeverityFromText(
  text: string,
  category: string | null,
): ClassificationSeverity {
  if (category === null) return null;

  const highSignals = [
    'critical',
    'критичес',
    'massive',
    'массов',
    'millions',
    'миллион',
    'active exploitation',
    'in the wild',
    'ransomware',
    'шифроваль',
    'утечк',
    'leakbase',
    'взлом',
    'скомпромет',
    'ddos',
    'apt',
    'госорган',
    'критическ',
    'кии',
    'scada',
    'крупным инцидентом',
    'утекло',
    'компрометация',
    'компрометирован',
    'remote code execution',
    'rce',
  ];
  if (highSignals.some((signal) => text.includes(signal))) return 'high';

  if (category === 'APT') return 'high';
  if (
    category === 'Physical-Cyber/ICS' &&
    (text.includes('кии') || text.includes('scada') || text.includes('госорган'))
  ) {
    return 'high';
  }
  if (
    category === 'Vulnerabilities & Exploits' &&
    (text.includes('zero-day') ||
      text.includes('0-day') ||
      text.includes('critical') ||
      text.includes('критичес'))
  ) {
    return 'high';
  }

  const lowSignals = [
    'исследован',
    'report',
    'отчет',
    'рынок',
    'статистик',
    'conference',
    'конференц',
    'заявил',
    'прокомментировал',
    'прокомментировали',
    'обсуждают',
    'инициатив',
    'может',
    'мог бы',
    'предупредил',
    'к 2029',
  ];
  if (
    lowSignals.some((signal) => text.includes(signal)) &&
    category !== 'Vulnerabilities & Exploits'
  ) {
    return 'low';
  }

  if (
    category === 'Fraud' &&
    (text.includes('звонок') ||
      text.includes('карты') ||
      text.includes('банковск') ||
      text.includes('деньг'))
  ) {
    return 'medium';
  }

  return 'medium';
}

function buildHeuristicClassification(input: {
  title: string;
  text: string;
  sourceName: string;
  url: string;
  hasThreatSignals: boolean;
}): ClassificationResult {
  const titleLower = input.title.toLowerCase();
  const bodyLower = input.text.toLowerCase().slice(0, 1800);
  const combined = `${titleLower} ${bodyLower}`;
  const country = inferCountryFromContext({
    url: input.url,
    sourceName: input.sourceName,
    title: input.title,
    text: input.text,
    current: 'Global',
  });

  const newsSignals = [
    'рынок',
    'выручк',
    'назначен',
    'выпустил',
    'релиз',
    'конференц',
    'форум',
    'исследован',
    'опрос',
    'статистик',
    'заявил',
    'прокомментир',
    'запустил',
    'антифрод',
    'обновили лабораторию',
    'подбор вакансий',
    'вырос',
    'киберучен',
    'снижен',
    'жалоб',
    'предпочитает',
    'комментар',
    'запустили промышленный обмен',
    'к 2029',
    'смогут',
    'может',
    'мог бы',
    'почему',
    'как',
    'исследователи',
    'аналитик',
    'суд',
    'арестован',
    'задержан',
    'задержали',
    'приговор',
    'расследован',
    'обвин',
  ];
  const strongIncidentSignals = [
    'взломали',
    'взлом',
    'утеч',
    'слили',
    'эксплуат',
    'эксплойт',
    'cve-',
    'ransomware',
    'шифроваль',
    'компромет',
    'credential',
    'leakbase',
    'ddos',
    'dos-атак',
    'фишинг',
    'phishing',
    'массово использовать ботов для атак',
  ];
  const commentarySignals = [
    'прокомментировал',
    'прокомментировали',
    'комментар',
    'обвинил',
    'обвинила',
    'заявил',
    'заявила',
    'сообщил',
    'сообщила',
    'предупредил',
    'предупредила',
  ];
  const aftermathSignals = [
    'суд',
    'арестован',
    'задержан',
    'задержали',
    'приговор',
    'экстрадиц',
  ];
  const exerciseSignals = [
    'киберучен',
    'кибериспытан',
    'bug bounty',
    'белые хакеры',
    'полигон',
    'имитацию хакерских атак',
  ];
  const governanceSignals = [
    'антифрод-платформ',
    'гис «антифрод»',
    'борьбе с мошенниками',
    'подключились крупнейшие операторы',
    'сейчас идет активное подключение',
    'техническая реализация базовых сценариев',
  ];
  const concreteThreatSignals = [
    'взлом',
    'утеч',
    'эксплойт',
    'уязвим',
    'cve-',
    'ddos',
    'ransomware',
    'шифроваль',
    'phishing',
    'фишинг',
    'троян',
    'botnet',
    'spyware',
    'malware',
    'компрометац',
    'credential',
    'leak',
    'атака',
    'хакер',
    'мошенник',
    'скам',
    'подмен',
    'вредонос',
    'скачали вредонос',
    'крупным инцидентом',
    'критическую уязвимость',
    'зараж',
    'компромет',
  ];

  const hasConcreteThreatSignals = hasAny(combined, concreteThreatSignals);
  const hasStrongIncidentSignals = hasAny(combined, strongIncidentSignals);
  const likelyNews =
    (hasAny(combined, newsSignals) || hasAny(combined, commentarySignals)) &&
    !hasConcreteThreatSignals;
  const likelyAftermathNews =
    hasAny(combined, aftermathSignals) && !hasStrongIncidentSignals;
  const speculativeNews =
    (combined.includes('может') ||
      combined.includes('мог бы') ||
      combined.includes('смогут') ||
      combined.includes('к 2029')) &&
    !combined.includes('эксплуат') &&
    !combined.includes('взломали') &&
    !combined.includes('утеч');
  const forcedNews =
    titleLower.includes('прокомментировали статью') ||
    titleLower.includes('на поле банки грохотали') ||
    titleLower.includes('единым «антифродом»') ||
    titleLower.includes('киберучений') ||
    (titleLower.includes('могут') &&
      (combined.includes('рекомендовали') ||
        combined.includes('не наблюдает случаев') ||
        combined.includes('не наблюдают случаев'))) ||
    (hasAny(combined, exerciseSignals) && combined.includes('рынок')) ||
    hasAny(combined, governanceSignals);

  const result: ClassificationResult = {
    type:
      forcedNews || speculativeNews
        ? 'news'
        : input.hasThreatSignals && !likelyNews && !likelyAftermathNews
        ? 'threat'
        : likelyNews
          ? 'news'
          : likelyAftermathNews
            ? 'news'
            : input.hasThreatSignals
              ? 'threat'
              : 'news',
    category: null,
    subcategory: null,
    severity: null,
    country,
    vulnerability_type: null,
    reasoning: 'Эвристическая классификация по текстовым признакам.',
  };

  if (result.type === 'news') {
    result.reasoning =
      'В тексте нет явного инцидента, эксплуатации или подтвержденной атаки.';
    return result;
  }

  if (
    combined.includes('axios') ||
    combined.includes('цепочки поставок') ||
    combined.includes('dependency') ||
    combined.includes('package') ||
    combined.includes('npm') ||
    combined.includes('javascript-библиотек') ||
    combined.includes('http-клиент')
  ) {
    result.category = 'Supply Chain';
    if (combined.includes('dependency') || combined.includes('package') || combined.includes('npm'))
      result.subcategory = 'compromised dependencies';
    else result.subcategory = 'third-party breach';
    result.reasoning =
      'В тексте есть компрометация цепочки поставок или зависимого компонента.';
  } else if (
    combined.includes('ransomware') ||
    combined.includes('шифроваль') ||
    combined.includes('trojan') ||
    combined.includes('троян') ||
    combined.includes('botnet') ||
    combined.includes('spyware') ||
    combined.includes('malware') ||
    combined.includes('вредонос')
  ) {
    result.category = 'Malware';
    if (combined.includes('ransom')) result.subcategory = 'ransomware';
    else if (combined.includes('spy')) result.subcategory = 'spyware';
    else if (combined.includes('botnet')) result.subcategory = 'botnet';
    else result.subcategory = 'trojan';
    result.reasoning =
      'В статье описан вредоносный код или его применение против цели.';
  } else if (
    combined.includes('phishing') ||
    combined.includes('фишинг') ||
    combined.includes('smishing') ||
    combined.includes('vishing') ||
    combined.includes('маскируют') ||
    combined.includes('поддельный сайт') ||
    combined.includes('поддельная страница') ||
    combined.includes('поддельное письмо') ||
    combined.includes('imperson')
  ) {
    result.category = 'Phishing';
    if (combined.includes('smishing')) result.subcategory = 'smishing';
    else if (combined.includes('vishing')) result.subcategory = 'vishing';
    else if (combined.includes('spear')) result.subcategory = 'spear-phishing';
    else if (combined.includes('поддельн') || combined.includes('imperson'))
      result.subcategory = 'impersonation';
    else result.subcategory = 'phishing';
    result.reasoning =
      'В тексте есть признаки социальной инженерии или фишинговой кампании.';
  } else if (
    combined.includes('cve-') ||
    combined.includes('zero-day') ||
    combined.includes('0-day') ||
    combined.includes('уязвим') ||
    combined.includes('эксплойт') ||
    combined.includes('proof of concept') ||
    combined.includes('poc')
  ) {
    result.category = 'Vulnerabilities & Exploits';
    if (combined.includes('zero-day') || combined.includes('0-day')) {
      result.subcategory = 'zero-day';
      result.vulnerability_type = '0-day';
    } else if (
      combined.includes('cve-') ||
      combined.includes('patch') ||
      combined.includes('poc')
    ) {
      result.subcategory = combined.includes('эксплуат') ||
        combined.includes('in the wild')
        ? 'exploit in the wild'
        : 'CVE disclosure';
      result.vulnerability_type = 'n-day';
    } else if (combined.includes('misconfig')) {
      result.subcategory = 'misconfiguration';
    }
    result.reasoning =
      'В статье описана уязвимость, эксплойт или эксплуатация известной бреши.';
  } else if (
    combined.includes('apt') ||
    combined.includes('шпион') ||
    combined.includes('проиран') ||
    combined.includes('иранск') ||
    combined.includes('северокорей') ||
    combined.includes('north korean') ||
    combined.includes('espion') ||
    combined.includes('кибервойн') ||
    combined.includes('директора фбр') ||
    combined.includes('госорган') ||
    combined.includes('политик') ||
    combined.includes('группировк')
  ) {
    result.category = 'APT';
    if (combined.includes('кибервойн')) result.subcategory = 'cyber warfare';
    else if (combined.includes('influence')) result.subcategory = 'influence operations';
    else if (combined.includes('sabot')) result.subcategory = 'sabotage';
    else result.subcategory = 'espionage';
    result.reasoning =
      'Статья указывает на целенаправленную кампанию, шпионаж или государственный контекст.';
  } else if (
    combined.includes('хакерских атак') ||
    combined.includes('миллионов хакерских атак') ||
    (combined.includes('реестр воинского учета') &&
      combined.includes('утечек персональных данных граждан не было'))
  ) {
    result.category = 'Network Attacks';
    result.subcategory = 'scanning campaigns';
    result.reasoning =
      'В статье описан поток атак на инфраструктуру без подтвержденной утечки данных.';
  } else if (
    (combined.includes('утеч') ||
      combined.includes('leak') ||
      combined.includes('dump') ||
      combined.includes('credential') ||
      combined.includes('слили') ||
      combined.includes('персональн') ||
      combined.includes('база данных') ||
      combined.includes('личными данными') ||
      combined.includes('личных данных') ||
      combined.includes('почту') ||
      combined.includes('почта директора') ||
      combined.includes('утекло')) &&
    !combined.includes('утечек персональных данных граждан не было') &&
    !combined.includes('утечек не было')
  ) {
    result.category = 'Data Breach';
    if (combined.includes('credential')) result.subcategory = 'credential exposure';
    else if (combined.includes('insider')) result.subcategory = 'insider leaks';
    else if (combined.includes('dump')) result.subcategory = 'dumps';
    else result.subcategory = 'leaks';
    result.reasoning =
      'В тексте есть признаки утечки данных, учетных записей или дампов.';
  } else if (
    combined.includes('ddos') ||
    combined.includes('dos-атак') ||
    combined.includes('сканир') ||
    (combined.includes('атак') &&
      !combined.includes('мошеннич') &&
      !combined.includes('фишинг')) ||
    combined.includes('bgp') ||
    combined.includes('dns')
  ) {
    result.category = 'Network Attacks';
    if (hasAsciiWord(combined, 'ddos') || combined.includes('dos-атак'))
      result.subcategory = 'DDoS';
    else if (combined.includes('bgp')) result.subcategory = 'BGP hijacking';
    else if (combined.includes('dns')) result.subcategory = 'DNS attacks';
    else if (combined.includes('сканир')) result.subcategory = 'scanning campaigns';
    result.reasoning =
      'В статье описана сетевая атака, перегрузка сервиса или активная разведка.';
  } else if (
    (combined.includes('мошеннич') ||
      combined.includes('fraud') ||
      combined.includes('скам') ||
      combined.includes('обман') ||
      combined.includes('похитили') ||
      combined.includes('списали') ||
      combined.includes('увели деньги') ||
      combined.includes('звонок мошенник') ||
      combined.includes('account takeover') ||
      combined.includes('угон аккаунт')) &&
    !combined.includes('phishing') &&
    !combined.includes('фишинг') &&
    !combined.includes('антифрод') &&
    !combined.includes('снижен') &&
    !combined.includes('жалоб') &&
    !combined.includes('предупред') &&
    !combined.includes('статистик')
  ) {
    result.category = 'Fraud';
    if (combined.includes('crypto')) result.subcategory = 'crypto scams';
    else if (
      combined.includes('аккаунт') ||
      combined.includes('account takeover') ||
      combined.includes('угон аккаунт')
    )
      result.subcategory = 'account takeover';
    else result.subcategory = 'payment fraud';
    result.reasoning =
      'В статье описана мошенническая схема, нацеленная на деньги или учетные записи.';
  } else if (
    combined.includes('cloud security') ||
    combined.includes('s3') ||
    combined.includes('bucket') ||
    combined.includes('kubernetes') ||
    combined.includes('aws') ||
    combined.includes('azure') ||
    combined.includes('gcp') ||
    combined.includes('iam') ||
    combined.includes('token')
  ) {
    result.category = 'Cloud Security';
    if (combined.includes('iam')) result.subcategory = 'IAM abuse';
    else if (combined.includes('token')) result.subcategory = 'token leakage';
    else result.subcategory = 'cloud misconfig';
    result.reasoning = 'В тексте описана облачная конфигурационная или IAM-угроза.';
  } else if (
    combined.includes('scada') ||
    combined.includes('кии') ||
    combined.includes('critical infrastructure') ||
    combined.includes('критическ') ||
    combined.includes('industrial')
  ) {
    result.category = 'Physical-Cyber/ICS';
    if (combined.includes('scada')) result.subcategory = 'SCADA';
    else if (combined.includes('industrial')) result.subcategory = 'industrial incidents';
    else result.subcategory = 'critical infrastructure';
    result.reasoning =
      'В статье фигурирует объект критической или промышленной инфраструктуры.';
  }

  if (
    result.type === 'threat' &&
    result.category === null &&
    speculativeNews
  ) {
    result.type = 'news';
    result.reasoning =
      'В тексте описан прогноз или обсуждение риска без подтвержденного инцидента.';
    return result;
  }

  if (
    result.type === 'threat' &&
    result.category === null &&
    !hasStrongIncidentSignals
  ) {
    result.type = 'news';
    result.reasoning =
      'В тексте есть общая тема ИБ, но нет подтвержденного инцидента или эксплуатации.';
    return result;
  }

  result.severity = pickSeverityFromText(combined, result.category);
  if (
    result.category === 'Network Attacks' &&
    result.subcategory === null &&
    combined.includes('атака')
  ) {
    result.subcategory = combined.includes('ddos') ? 'DDoS' : 'scanning campaigns';
  }
  if (
    result.category === 'Vulnerabilities & Exploits' &&
    result.subcategory === null
  ) {
    result.subcategory = combined.includes('misconfig')
      ? 'misconfiguration'
      : 'CVE disclosure';
  }
  if (!result.reasoning || result.reasoning === 'Auto-classified') {
    result.reasoning =
      'Классификация построена по ключевым признакам атаки и характера инцидента.';
  }
  return result;
}

@Injectable()
export class CrawlerService implements OnModuleInit {
  private readonly logger = new Logger(CrawlerService.name);
  private readonly runtimeLogs: string[] = [];
  private readonly maxRuntimeLogs = 500;
  private sources: Source[] = [];
  private qdrantClient: QdrantClient;
  private embeddings: OpenAIEmbeddings;
  private chatOpenAI: ChatOpenAI;
  private classifierModel: string;
  private classifierMaxTokens: number;
  private classifierTimeoutMs: number;
  private embeddingTimeoutMs: number;
  private disableLlm: boolean;
  private disableEmbeddings: boolean;
  private crawlerDebug: boolean;
  private crawlConcurrency: number;
  private sourceConcurrency: number;
  private crawlAllRunning = false;
  private activeCrawlScope: 'all' | 'sites' | null = null;
  private readonly inFlightUrls = new Set<string>();

  constructor(
    @InjectModel(Article.name) private articleModel: Model<Article>,
    private configService: ConfigService,
    private readonly referenceIntelService: ReferenceIntelService,
  ) {
    this.wrapLogger();
  }

  private wrapLogger() {
    const originalLog = this.logger.log.bind(this.logger);
    const originalWarn = this.logger.warn.bind(this.logger);
    const originalError = this.logger.error.bind(this.logger);

    this.logger.log = ((message: unknown, ...optionalParams: unknown[]) => {
      this.pushRuntimeLog('LOG', message, optionalParams);
      return originalLog(message as never, ...(optionalParams as never[]));
    }) as typeof this.logger.log;

    this.logger.warn = ((message: unknown, ...optionalParams: unknown[]) => {
      this.pushRuntimeLog('WARN', message, optionalParams);
      return originalWarn(message as never, ...(optionalParams as never[]));
    }) as typeof this.logger.warn;

    this.logger.error = ((message: unknown, ...optionalParams: unknown[]) => {
      this.pushRuntimeLog('ERROR', message, optionalParams);
      return originalError(message as never, ...(optionalParams as never[]));
    }) as typeof this.logger.error;
  }

  private pushRuntimeLog(
    level: 'LOG' | 'WARN' | 'ERROR',
    message: unknown,
    optionalParams: unknown[] = [],
  ) {
    const renderedMessage = [message, ...optionalParams]
      .flat()
      .filter((item) => item !== undefined && item !== null && item !== '')
      .map((item) => {
        if (item instanceof Error) {
          return item.stack || item.message;
        }

        return typeof item === 'string' ? item : JSON.stringify(item);
      })
      .join(' ');

    const timestamp = new Date().toLocaleTimeString('ru-RU');
    this.runtimeLogs.push(`[${timestamp}] ${level}: ${renderedMessage}`);

    if (this.runtimeLogs.length > this.maxRuntimeLogs) {
      this.runtimeLogs.splice(0, this.runtimeLogs.length - this.maxRuntimeLogs);
    }
  }

  onModuleInit() {
    this.loadSources();
    this.initQdrant();
    this.initEmbeddings();
  }

  private loadSources() {
    try {
      const candidates = [
        path.resolve(__dirname, 'sources.json'),
        path.resolve(process.cwd(), 'src', 'crawler', 'sources.json'),
        path.resolve(process.cwd(), 'dist', 'crawler', 'sources.json'),
      ];
      const sourcesPath = candidates.find((p) => fs.existsSync(p));
      if (!sourcesPath) throw new Error('sources.json not found');

      const sourcesData = fs.readFileSync(sourcesPath, 'utf8');
      const parsed = safeJsonParse(sourcesData);
      if (!Array.isArray(parsed) || !parsed.every(isSource)) {
        throw new Error('Invalid sources.json format');
      }
      this.sources = parsed;
      this.logger.log(
        `Loaded ${this.sources.length} sources from ${sourcesPath}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to load sources.json: ${message}`);
      this.sources = [];
    }
  }

  private initQdrant() {
    const qdrantUrl =
      this.configService.get<string>('QDRANT_URL') ?? 'http://127.0.0.1:6333';
    this.qdrantClient = new QdrantClient({ url: qdrantUrl });
    this.logger.log(`Initializing Qdrant client at: ${qdrantUrl}`);
  }

  private initEmbeddings() {
    this.embeddings = new OpenAIEmbeddings({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
      model: 'openai/text-embedding-3-small', // Specify the embedding model
      configuration: {
        baseURL: 'https://openrouter.ai/api/v1',
      },
    });
    this.logger.log(`HOST_URL: ${this.configService.get<string>('HOST_URL')}`);
    this.logger.log(`APP_NAME: ${this.configService.get<string>('APP_NAME')}`);
    this.classifierModel =
      this.configService.get<string>('OPENROUTER_CLASSIFIER_MODEL') ??
      'openrouter/free';
    const maxTokensRaw =
      this.configService.get<string>('OPENROUTER_CLASSIFIER_MAX_TOKENS') ?? '';
    this.classifierMaxTokens =
      Number(maxTokensRaw) > 0 ? Number(maxTokensRaw) : 220;
    const classifierTimeoutRaw =
      this.configService.get<string>('OPENROUTER_CLASSIFIER_TIMEOUT_MS') ?? '';
    this.classifierTimeoutMs =
      Number(classifierTimeoutRaw) > 0 ? Number(classifierTimeoutRaw) : 15000;
    const embeddingTimeoutRaw =
      this.configService.get<string>('OPENROUTER_EMBEDDING_TIMEOUT_MS') ?? '';
    this.embeddingTimeoutMs =
      Number(embeddingTimeoutRaw) > 0 ? Number(embeddingTimeoutRaw) : 10000;
    this.disableLlm =
      this.configService.get<string>('CRAWLER_DISABLE_LLM') === '1';
    this.disableEmbeddings =
      this.configService.get<string>('CRAWLER_DISABLE_EMBEDDINGS') === '1';

    this.chatOpenAI = new ChatOpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
      model: this.classifierModel,
      temperature: 0,
      maxTokens: this.classifierMaxTokens,
      configuration: {
        baseURL: 'https://openrouter.ai/api/v1',
      },
    });
    this.logger.log(
      `Initializing OpenAI clients with model ${this.classifierModel}`,
    );

    this.crawlerDebug =
      this.configService.get<string>('CRAWLER_DEBUG') === '1';
    const concurrencyRaw =
      this.configService.get<string>('CRAWLER_CONCURRENCY') ?? '3';
    const parsedConcurrency = Number(concurrencyRaw);
    this.crawlConcurrency =
      Number.isFinite(parsedConcurrency) && parsedConcurrency > 0
        ? Math.floor(parsedConcurrency)
        : 3;
    const sourceConcurrencyRaw =
      this.configService.get<string>('CRAWLER_SOURCE_CONCURRENCY') ?? '1';
    const parsedSourceConcurrency = Number(sourceConcurrencyRaw);
    this.sourceConcurrency =
      Number.isFinite(parsedSourceConcurrency) && parsedSourceConcurrency > 0
        ? Math.floor(parsedSourceConcurrency)
        : 1;
  }

  private async ensureQdrantCollection(): Promise<void> {
    try {
      await this.qdrantClient.getCollection('articles');
    } catch {
      await this.qdrantClient.createCollection('articles', {
        vectors: { size: 1536, distance: 'Cosine' },
      });
    }
  }

  async crawlAllSources() {
    if (this.crawlAllRunning) {
      this.logger.warn('crawlAllSources уже выполняется, повторный запуск пропущен');
      return;
    }

    this.crawlAllRunning = true;
    this.activeCrawlScope = this.activeCrawlScope || 'all';
    this.logger.log('--- START CRAWLING ---');
    try {
      await runWithConcurrency(
        this.sources,
        this.sourceConcurrency,
        async (source) => {
        this.logger.log(`Crawling source: ${source.name}`);
        await this.crawlSource(source);
        },
      );
      this.logger.log('--- CRAWLING FINISHED ---');
    } finally {
      this.crawlAllRunning = false;
      this.activeCrawlScope = null;
    }
  }

  startCrawlAllSources(): boolean {
    if (this.crawlAllRunning) {
      return false;
    }

    this.activeCrawlScope = 'all';
    void this.crawlAllSources();
    return true;
  }

  startSiteCrawl(): boolean {
    if (this.crawlAllRunning) {
      return false;
    }

    this.activeCrawlScope = 'sites';
    void this.crawlAllSources();
    return true;
  }

  isCrawlRunning(): boolean {
    return this.crawlAllRunning;
  }

  getActiveCrawlScope(): 'all' | 'sites' | null {
    return this.activeCrawlScope;
  }

  getSourceCount(): number {
    return this.sources.length;
  }

  getRecentLogs(limit = 200) {
    const lines = this.runtimeLogs.slice(-limit);

    return {
      lines: lines.length ? lines : ['Логи текущего процесса пока пусты.'],
      source: 'runtime-buffer',
    };
  }

  async crawlArticle(url: string) {
    this.logger.log(`--- START CRAWLING SINGLE ARTICLE ---`);
    await this.parseAndSave(url, 'Manual Crawl');
    this.logger.log(`--- CRAWLING SINGLE ARTICLE FINISHED ---`);
  }

  private async crawlSource(source: Source) {
    // рендер страницы Playwright
    const browser = await chromium.launch();
    const page = await browser.newPage();

    try {
      // Обработка сообщений консоли из Playwright
      page.on('console', (msg) => {
        if (this.crawlerDebug) {
          this.logger.log(`PAGE CONSOLE [${msg.type()}]: ${msg.text()}`);
        }
      });
      // Обработка ошибок страницы из Playwright
      page.on('pageerror', (err) => {
        this.logger.error(`PAGE ERROR: ${err.message}`);
      });

      this.logger.log(`Навигация к: ${source.url}`);
      await page.goto(source.url, { timeout: 60000 }); // Ждем загрузки с таймаутом 60 секунд

      const pageContent = await page.content(); // Get the full HTML content
      this.logger.log(`Full HTML content length: ${pageContent.length}`);

      // Находим все ссылки на статьи на странице
      const links = await page.evaluate((sourceUrl) => {
        const anchors = Array.from(document.querySelectorAll('a'));
        const allLinks = anchors
          .map((a) => {
            return {
              href: a.href,
              text: a.innerText.trim(),
            };
          })
          .filter((link) => link.href);

        const sourceHostname = new URL(sourceUrl).hostname;
        const filteredLinks = allLinks
          .filter((link) => {
            try {
              const linkUrl = new URL(link.href);
              if (linkUrl.hostname !== sourceHostname) return false;

              // General exclusions
              if (link.href.includes('?sub=')) return false;
              if (link.href === sourceUrl || link.href === sourceUrl + '/')
                return false;

              // Source-specific rules
              switch (sourceHostname) {
                case 'www.kommersant.ru':
                  return (
                    /\/doc\/\d{7}(\/|\?|$)/.test(link.href) &&
                    !link.href.includes('?from=')
                  );
                case 'www.kaspersky.ru':
                  return (
                    link.href.includes('/press-releases/') &&
                    !link.href.includes('/about/press-releases?page=') &&
                    !link.href.endsWith('/about/press-releases') &&
                    !link.href.endsWith('/about/press-releases/') &&
                    link.href.split('/').filter(Boolean).length >= 4
                  );
                case 'www.securitylab.ru':
                  return (
                    (link.href.includes('/news/') ||
                      link.href.includes('/analytics/')) &&
                    /\.php$/.test(link.href) &&
                    !link.href.includes('/blog/') &&
                    !link.href.includes('/forum/') &&
                    !/page\d+_\d+\.php/.test(link.href)
                  );
                case 'www.comnews.ru':
                  return (
                    link.href.includes('/content/') &&
                    /\/\d{4}-\d{2}-\d{2}\//.test(link.href)
                  ); // Contains date in path
                case 'www.infowatch.ru':
                  return (
                    link.href.includes('/analytics/novosti-ib/') &&
                    !link.href.includes('/tag/') &&
                    !link.href.includes('/page/')
                  );
                case 'habr.com':
                  return /\/ru\/news\/\d{7}\/?$/.test(link.href);
                case 'www.f6.ru':
                  return (
                    link.href.includes('/media-center/news/') &&
                    !link.href.includes('/page/') &&
                    link.href.split('/').filter(Boolean).length >= 4
                  );
                case '1275.ru': {
                  // Added block scope
                  if (
                    link.href === 'https://1275.ru/vulnerability' ||
                    link.href === 'https://1275.ru/news'
                  )
                    return false; // Explicitly banned links
                  if (link.href.includes('#comments')) return false; // Exclude comment anchors
                  const cleanedHref = link.href.split('#')[0]; // Remove anchors
                  const isArticleLink =
                    (cleanedHref.includes('/vulnerability/') &&
                      cleanedHref.split('/').filter(Boolean).length > 2) ||
                    (cleanedHref.includes('/news/') &&
                      cleanedHref.split('/').filter(Boolean).length > 2);
                  const isBlacklisted =
                    cleanedHref.includes('/tag/') ||
                    cleanedHref.includes('/popular') ||
                    cleanedHref.includes('/subs') ||
                    cleanedHref.includes('/top') ||
                    cleanedHref.includes('/bookmarks') ||
                    cleanedHref.includes('/rss-feeds') ||
                    cleanedHref.includes('/rules') ||
                    cleanedHref.includes('/privacy-policy') ||
                    cleanedHref.includes('/contacts');
                  return isArticleLink && !isBlacklisted;
                }
                case 'infobezopasnost.ru':
                  return (
                    link.href.includes('/blog/news/') &&
                    link.href.split('/').filter(Boolean).length >= 4 &&
                    !link.href.includes('/page/')
                  );
                case 'www.bleepingcomputer.com':
                  return (
                    link.href.includes('/news/') &&
                    !link.href.endsWith('/news/') &&
                    !link.href.endsWith('/news') &&
                    !link.href.includes('/page/') &&
                    !link.href.includes('/news/security/page/') &&
                    !link.href.includes('/tag/') &&
                    !link.href.includes('/downloads/') &&
                    !link.href.includes('/guides/') &&
                    !link.href.includes('/forums/') &&
                    !link.href.includes('/tag/') &&
                    link.href.split('/').filter(Boolean).length >= 4
                  );
                case 'www.securityweek.com':
                  return (
                    !link.href.endsWith('/#') &&
                    !link.href.endsWith('.com/') &&
                    !link.href.endsWith('.com') &&
                    !link.href.includes('#') &&
                    !link.href.includes('/category/') &&
                    !link.href.includes('/tag/') &&
                    !link.href.includes('/topics/') &&
                    !link.href.includes('/podcast/') &&
                    !link.href.includes('/webcasts/') &&
                    !link.href.includes('/white-papers/') &&
                    !link.href.includes('/resources/') &&
                    !link.href.includes('/about/') &&
                    !link.href.includes('/contact') &&
                    !link.href.includes('/contributors/') &&
                    !link.href.includes('/subscribe') &&
                    !link.href.includes('/feed') &&
                    !link.href.includes('/privacy-policy') &&
                    !link.href.includes('/submit-tip') &&
                    link.href.split('/').filter(Boolean).length >= 2 &&
                    (() => {
                      const segments = link.href.split('/').filter(Boolean);
                      const last = segments[segments.length - 1] ?? '';
                      return last.includes('-');
                    })()
                  );
                case 'thehackernews.com':
                  return (
                    /\.html?$/.test(link.href) &&
                    /\d{4}\/\d{2}\//.test(link.href) &&
                    !link.href.includes('/search/') &&
                    !link.href.includes('/p/') &&
                    !link.href.includes('/expert-insights/')
                  );
                default:
                  // Default to allowing any link on the same hostname for truly unknown sources, or if no specific rule applies
                  return true;
              }
            } catch {
              // Ignore invalid URLs
              return false;
            }
          })
          .map((link) => link.href); // Extract just the href for the final list
        return Array.from(new Set(filteredLinks)); // Удаляем дубликаты
      }, source.url);

      this.logger.log(
        `Найдено ${links.length} потенциальных статей на ${source.name}`,
      );

      await runWithConcurrency(links, this.crawlConcurrency, async (link) => {
        try {
          const fullUrl = new URL(link, source.url).href;
          this.logger.log(`Обработка ссылки: ${fullUrl}`);
          await this.parseAndSave(fullUrl, source.name);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          this.logger.error(`Ошибка при обработке ссылки ${link}: ${message}`);
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Ошибка при сборе данных с источника ${source.url}: ${message}`,
      );
    } finally {
      await browser.close();
    }
  }

  async parseAndSave(url: string, sourceName: string): Promise<Article | null> {
    this.logger.log(`Парсинг и сохранение: ${url}`);

    if (this.inFlightUrls.has(url)) {
      this.logger.warn(`Статья уже в обработке, пропускаем повтор: ${url}`);
      return null;
    }

    this.inFlightUrls.add(url);
    const dryRun = this.configService.get<string>('CRAWLER_DRY_RUN') === '1';
    try {
      const existingArticle = await this.articleModel.findOne({ url });
      if (existingArticle) {
        this.logger.log(`Статья уже существует, пропускаем: ${url}`);
        return existingArticle;
      }
      if (!dryRun) {
        await this.ensureQdrantCollection();
      }

      // извлечение текста Trafilatura
      const parserScriptPath = path.join(
        process.cwd(),
        'scripts',
        'parse_article.py',
      );
      const { stdout, stderr } = await execFilePromise(
        'python3',
        [parserScriptPath, url],
        {
          maxBuffer: 10 * 1024 * 1024,
        },
      );

      if (stderr) {
        this.logger.error(
          `Ошибка выполнения Python скрипта для ${url}: ${stderr}`,
        );
        return null;
      }

      const rawArticleData = safeJsonParse(stdout);
      if (!isParsedArticleResult(rawArticleData)) {
        this.logger.error(
          `Ошибка парсинга статьи ${url}: invalid JSON payload`,
        );
        return null;
      }
      const articleData = rawArticleData;

      if (
        typeof articleData.error === 'string' &&
        articleData.error.length > 0
      ) {
        this.logger.error(
          `Ошибка парсинга статьи ${url}: ${articleData.error}`,
        );
        return null;
      }
      if (
        !isCybersecurityRelevantArticle(
          articleData.title ?? '',
          articleData.text ?? '',
        )
      ) {
        this.logger.log(`Нерелевантная статья для ИБ, пропускаем: ${url}`);
        return null;
      }
      const threatKeywords = [
        'cve',
        'vulnerability',
        'exploit',
        '0-day',
        'zero-day',
        'malware',
        'ransomware',
        'trojan',
        'spyware',
        'botnet',
        'breach',
        'attack',
        'hack',
        'phishing',
        'ddos',
        'rce',
        'data leak',
        'credential',
        'leak',
        'хакер',
        'взлом',
        'взломал',
        'взломали',
        'эксплойт',
        'фишинг',
        'скимминг',
        'мошеннич',
        'утеч',
        'компрометац',
        'DDoS'.toLowerCase(),
        'уязвимость',
        'атака',
        'вредонос',
        'утечка',
      ];
      const hasThreatSignals = threatKeywords.some(
        (keyword) =>
          (articleData.text?.toLowerCase() ?? '').includes(keyword) ||
          (articleData.title?.toLowerCase() ?? '').includes(keyword),
      );

      // 2. Умная нарезка текста: берем начало и конец статьи
      const text = articleData.text ?? '';
      const snippet =
        text.length > 1200
          ? `${text.substring(0, 700)}\n...\n${text.substring(Math.max(0, text.length - 350))}`
          : text;

      // 3. Улучшенный промпт с примерами (Few-shot) и строгими правилами
      const classificationPrompt = `
Ты классифицируешь статьи для OSINT по киберугрозам.
Верни РОВНО один JSON-объект в одну строку. Без Markdown. Без пояснений.

Схема:
{"type":"news|threat","category":"Вредоносное ПО|Фишинг|Уязвимости и эксплуатация|Утечки данных|Сетевые атаки|Атаки на цепочку поставок|APT-активность|Мошенничество|Облачная безопасность|Промышленные и киберфизические атаки|null","subcategory":string|null,"severity":"high|medium|low|null","country":string,"vulnerability_type":"0-day|n-day|null","reasoning":string}

Главное правило:
- "threat" ставь только если в тексте описан КОНКРЕТНЫЙ киберинцидент, эксплуатация, вредоносная кампания, утечка, компрометация, DDoS/сетевая атака, активное мошенничество, заражение, APT-операция или подтвержденное злоупотребление.
- Если статья про комментарии, рынок, политику, суд, задержание, прогноз, исследование, релиз, патч без эксплуатации, статистику, предупреждение, обсуждение тренда, антифрод-инициативу или регулирование, то это "news".

Анти-ложноположительные правила:
- Не ставь "threat" только из-за слов "хакер", "атака", "мошенники", "утечка", "уязвимость", если статья лишь обсуждает тему без нового подтвержденного инцидента.
- Не ставь "threat" для интервью, заявлений компаний, судебных новостей, арестов, комментариев к прошлому инциденту, прогнозов и аналитики.
- Патч/обновление/релиз = "news", если не сказано, что уязвимость уже эксплуатируется или есть реальная компрометация.
- "threat" требует наблюдаемого вредоносного события, а не просто кибер-контекста.

Поле severity:
- Заполняй только для threat.
- high: массовый ущерб, активная эксплуатация, критическая инфраструктура, крупная утечка, ransomware, APT.
- medium: подтвержденный, но ограниченный инцидент или эксплуатация без явного крупного ущерба.
- low: слабый, локальный или предварительный подтвержденный инцидент.
- Для news severity=null.

Поле vulnerability_type:
- Только для "Vulnerabilities & Exploits".
- "0-day" если явно сказано zero-day/0-day/неизвестная ранее уязвимость.
- "n-day" если есть CVE, патч, PoC или известная уязвимость.
- Иначе null.

Поле country:
- Страна жертвы, инцидента или основной затронутой стороны.
- Если уверенно определить нельзя, используй "Global".

reasoning:
- Коротко на русском, до 90 символов.
- Объясняй решение по факту события, а не по отдельным словам.

Категории и подкатегории возвращай СРАЗУ НА РУССКОМ, строго из списка:
Вредоносное ПО -> Программа-вымогатель|Шпионское ПО|Троян|Ботнет
Фишинг -> Фишинговая рассылка|Целевой фишинг|Смишинг|Вишинг|Имперсонация
Уязвимости и эксплуатация -> Уязвимость нулевого дня|Публикация CVE|Эксплуатация в реальной среде|Небезопасная конфигурация
Утечки данных -> Утечка|Слив баз данных|Компрометация учётных данных|Внутренняя утечка
Сетевые атаки -> DDoS-атака|Перехват BGP|DNS-атака|Кампания сканирования
Атаки на цепочку поставок -> Скомпрометированные зависимости|Отравленные обновления|Компрометация подрядчика
APT-активность -> Кибершпионаж|Саботаж|Операции влияния|Кибервойна
Мошенничество -> Платёжное мошенничество|Криптомошенничество|Захват учётной записи
Облачная безопасность -> Злоупотребление IAM|Небезопасная облачная конфигурация|Утечка токенов
Промышленные и киберфизические атаки -> SCADA-инцидент|Критическая инфраструктура|Промышленный инцидент

Примеры:
- "Компания прокомментировала статью о хакерах" -> news
- "Вышло обновление, закрывающее уязвимость" -> news, если нет эксплуатации
- "Обнаружена активная эксплуатация CVE" -> threat
- "Мошенники рассылают фальшивые обновления и заражают пользователей" -> threat

Вход:
source=${sourceName}
title=${articleData.title ?? ''}
text=${snippet}
      `;

      const classificationPromptShort = `
Один JSON в одну строку.
threat только если есть подтвержденный киберинцидент, эксплуатация, утечка, заражение, активная кампания или злоупотребление.
Комментарий, прогноз, суд, релиз, патч без эксплуатации, статистика, исследование, интервью, инициатива = news.
Для news все threat-поля null.
reasoning до 90 символов.
Формат:
{"type":"news|threat","category":"Вредоносное ПО|Фишинг|Уязвимости и эксплуатация|Утечки данных|Сетевые атаки|Атаки на цепочку поставок|APT-активность|Мошенничество|Облачная безопасность|Промышленные и киберфизические атаки|null","subcategory":string|null,"severity":"high|medium|low|null","country":string,"vulnerability_type":"0-day|n-day|null","reasoning":string}
title=${articleData.title ?? ''}
text=${text.length > 700 ? text.substring(0, 700) : text}
      `;

      let classification: ClassificationResult = buildHeuristicClassification({
        title: articleData.title ?? '',
        text,
        sourceName,
        url,
        hasThreatSignals,
      });
      let modelUsed: string | null = null;
      let modelRaw: string | null = null;
      let llmError: string | null = null;
      let skipMetricsLlm = this.disableLlm;

      if (this.disableLlm) {
        llmError = 'LLM disabled by CRAWLER_DISABLE_LLM=1';
      } else {
        try {
          this.logger.log(`Запрос классификации для: ${url}`);
          const tryInvoke = async (
            llm: ChatOpenAI,
            label: string,
            prompt: string,
          ) => {
            const response = await withTimeout(
              () => llm.invoke(prompt),
              this.classifierTimeoutMs,
              `Classification request (${label})`,
            );
            const content = normalizeModelContent(response?.content);
            return { response, content, label };
          };

          const tryParse = (content: string) => {
            const parsed = extractJsonObjectFromText(content);
            if (!isClassificationResult(parsed)) throw new Error('Invalid JSON');
            return parsed;
          };

          const runAttempt = async (args: {
            llm: ChatOpenAI;
            label: string;
            prompt: string;
          }): Promise<ClassificationResult> => {
            const attempt = await tryInvoke(args.llm, args.label, args.prompt);
            modelUsed = attempt.label;
            modelRaw = attempt.content;
            if (!attempt.content) throw new Error('Empty model content');
            return tryParse(attempt.content);
          };

          const runWithRetries = async (
            fn: () => Promise<ClassificationResult>,
          ): Promise<ClassificationResult> => {
            let last: unknown = null;
            for (let i = 0; i < 3; i += 1) {
              try {
                return await fn();
              } catch (e) {
                last = e;
                const msg = e instanceof Error ? e.message : String(e);
                if (!shouldRetryClassificationError(msg)) throw e;
                await sleep(250 * (i + 1));
              }
            }
            const msg = last instanceof Error ? last.message : String(last);
            throw new Error(msg);
          };

          const buildModel = (model: string) => {
            const apiKey = this.configService.get<string>('OPENAI_API_KEY');
            return new ChatOpenAI({
              apiKey,
              model,
              temperature: 0,
              maxTokens: this.classifierMaxTokens,
              configuration: {
                baseURL: 'https://openrouter.ai/api/v1',
              },
            });
          };

          const fallbacks = Array.from(
            new Set([this.classifierModel, 'openrouter/free']),
          );

          let lastError: unknown = null;
          for (const model of fallbacks) {
            const llm =
              model === this.classifierModel
                ? this.chatOpenAI
                : buildModel(model);

            try {
              classification = await runWithRetries(() =>
                runAttempt({ llm, label: model, prompt: classificationPrompt }),
              );
              lastError = null;
              break;
            } catch (e1) {
              lastError = e1;
            }

            try {
              classification = await runWithRetries(() =>
                runAttempt({
                  llm,
                  label: model,
                  prompt: classificationPromptShort,
                }),
              );
              lastError = null;
              break;
            } catch (e2) {
              lastError = e2;
            }
          }

          if (lastError) {
            const msg =
              lastError instanceof Error
                ? lastError.message
                : typeof lastError === 'string'
                  ? lastError
                  : isRecord(lastError)
                    ? JSON.stringify(lastError)
                    : 'Unknown error';
            throw new Error(msg);
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          this.logger.error(`Classification failed for ${url}: ${message}`);
          if (err instanceof Error && err.stack) this.logger.error(err.stack);
          llmError = message;
          skipMetricsLlm = true;
        }
      }

      const allowedCategories = new Set([
        'Malware',
        'Phishing',
        'Vulnerabilities & Exploits',
        'Data Breach',
        'Network Attacks',
        'Supply Chain',
        'APT',
        'Fraud',
        'Cloud Security',
        'Physical-Cyber/ICS',
      ]);

      classification.category = normalizeCategoryToCanonicalEnglish(
        classification.category,
      );
      classification.subcategory = normalizeSubcategoryToCanonicalEnglish(
        classification.category,
        classification.subcategory,
      );

      if (
        classification.category !== null &&
        !allowedCategories.has(classification.category)
      ) {
        classification.category = null;
      }

      classification.category =
        classification.category === null
          ? null
          : normalizeNullableString(classification.category);
      classification.subcategory =
        classification.subcategory === null
          ? null
          : normalizeNullableString(classification.subcategory);
      classification.subcategory = normalizeSubcategoryForCategory(
        classification.category,
        classification.subcategory,
      );
      classification.country = normalizeCountryName(classification.country);
      classification.vulnerability_type = normalizeNullableString(
        classification.vulnerability_type ?? null,
      );

      if (classification.type === 'news') {
        classification.category = null;
        classification.subcategory = null;
        classification.severity = null;
        classification.vulnerability_type = null;
      }

      if (
        classification.type === 'threat' &&
        classification.category === null
      ) {
        const kw = `${(articleData.title ?? '').toLowerCase()} ${text.toLowerCase()}`;
        if (
          kw.includes('apt') ||
          kw.includes('северокорей') ||
          kw.includes('проиранск') ||
          kw.includes('иранск') ||
          kw.includes('шпион') ||
          kw.includes('cyber warfare') ||
          kw.includes('политик') ||
          kw.includes('директора фбр')
        ) {
          classification.category = 'APT';
          if (classification.subcategory === null)
            classification.subcategory = 'espionage';
        } else if (
          kw.includes('фишинг') ||
          kw.includes('phishing') ||
          kw.includes('мошенник')
        ) {
          classification.category = 'Phishing';
          if (classification.subcategory === null)
            classification.subcategory = 'impersonation';
        } else if (
          kw.includes('cve') ||
          kw.includes('уязвим') ||
          kw.includes('эксплойт') ||
          kw.includes('0-day') ||
          kw.includes('zero-day')
        ) {
          classification.category = 'Vulnerabilities & Exploits';
        } else if (
          kw.includes('ddos') ||
          kw.includes('сканир') ||
          kw.includes('реестр воинского') ||
          kw.includes('реестр') ||
          kw.includes('атака')
        ) {
          classification.category = 'Network Attacks';
          if (kw.includes('сканир') && classification.subcategory === null)
            classification.subcategory = 'scanning campaigns';
        } else if (
          kw.includes('утечк') ||
          kw.includes('личными данными') ||
          kw.includes('почту') ||
          kw.includes('взломали почту') ||
          kw.includes('компрометац') ||
          kw.includes('dumps') ||
          kw.includes('leak')
        ) {
          classification.category = 'Data Breach';
          if (classification.subcategory === null)
            classification.subcategory = 'credential exposure';
        } else if (
          kw.includes('облако') ||
          kw.includes('iam') ||
          kw.includes('токен') ||
          kw.includes('cloud')
        ) {
          classification.category = 'Cloud Security';
        } else if (
          kw.includes('зависимост') ||
          kw.includes('supply chain') ||
          kw.includes('third-party')
        ) {
          classification.category = 'Supply Chain';
        } else if (
          kw.includes('scada') ||
          kw.includes('критическ') ||
          kw.includes('индустриаль')
        ) {
          classification.category = 'Physical-Cyber/ICS';
        } else if (
          (kw.includes('мошеннич') ||
          kw.includes('fraud') ||
          kw.includes('crypto') ||
          kw.includes('похитили') ||
          kw.includes('увели деньги')) &&
          !kw.includes('антифрод') &&
          !kw.includes('жалоб')
        ) {
          classification.category = 'Fraud';
        } else if (
          kw.includes('malware') ||
          kw.includes('вредонос') ||
          kw.includes('ransomware') ||
          kw.includes('троян')
        ) {
          classification.category = 'Malware';
        }
      }

      if (
        !classification.reasoning ||
        classification.reasoning === 'Auto-classified'
      ) {
        classification.reasoning =
          classification.type === 'news'
            ? 'В статье нет подтвержденного инцидента или эксплуатации.'
            : 'Обнаружены признаки инцидента и вредоносной активности.';
      }

      if (classification.reasoning.length > 160) {
        classification.reasoning =
          classification.reasoning.slice(0, 157) + '...';
      }

      const inferredCountry = inferCountryFromContext({
        url,
        sourceName,
        title: articleData.title ?? '',
        text,
        current: classification.country,
      });

      const metricsLogPath =
        this.configService.get<string>('CRAWLER_METRICS_LOG_PATH') ??
        path.join(process.cwd(), 'tmp', 'metrics_results.jsonl');

      const metricsPrompt = `
Верни ровно один JSON в одну строку. Без Markdown.

Все числовые метрики должны быть вещественными числами в диапазоне от 0 до 1.
Используй непрерывную шкалу, а не фиксированные ступени.
Допустимо 2-3 знака после запятой, например 0.17, 0.58, 0.91.

Схема:
{"target_sector":"energy|finance|gov|generic","sub_sector":string|null,"attack_scale":number,"region":string|null,"attack_vector":"network|local|adjacent|physical","exposure_required":boolean,"user_interaction":boolean,"complexity":number,"exploit_available":number,"privileges_required":number,"impact_confidentiality":number,"impact_integrity":number,"impact_availability":number,"active_exploitation":boolean,"time_to_exploit":number,"llm_confidence":number,"extracted_at":string}

Правила:
- Оценивай только по конкретному подтвержденному инциденту/сценарию из текста.
- Не придумывай ущерб, привилегии, эксплойт или масштаб, если в тексте этого нет.
- Если признак не подтвержден, ставь осторожное низкое значение, близкое к 0, а не среднее по умолчанию.
- attack_scale должен отражать реальный размах инцидента, а не общую опасность темы.
- impact_confidentiality/integrity/availability выставляй независимо друг от друга по фактическим последствиям.
- active_exploitation=true только если прямо сказано, что атака/эксплуатация уже идет или шла на реальных целях.
- target_sector: energy|finance|gov|generic.
- attack_vector: network|local|adjacent|physical.
- exploit_available: около 0.9 если явно active exploitation / in the wild, около 0.65 если есть PoC/CVE/эксплойт, 0 если ничего нет.
- privileges_required: none около 0.9, user около 0.55, admin/root около 0.25, unknown около 0.55.
- Если данных мало, используй осторожные промежуточные значения, а не только крайние.
- extracted_at = текущий ISO timestamp.

Вход:
title=${articleData.title ?? ''}
country_hint=${inferredCountry}
type=${classification.type}
category=${classification.category ?? 'null'}
text=${snippet}
`;

      const metricsPromptShort = `
Один JSON в одну строку.
Все числа в диапазоне 0..1, не ограничивайся фиксированными значениями.
Если данных мало, используй низкие осторожные значения, а не средние по умолчанию.
Оценивай только подтвержденный инцидент из текста, ничего не додумывай.
{"target_sector":"energy|finance|gov|generic","sub_sector":string|null,"attack_scale":number,"region":string|null,"attack_vector":"network|local|adjacent|physical","exposure_required":boolean,"user_interaction":boolean,"complexity":number,"exploit_available":number,"privileges_required":number,"impact_confidentiality":number,"impact_integrity":number,"impact_availability":number,"active_exploitation":boolean,"time_to_exploit":number,"llm_confidence":number,"extracted_at":string}
title=${articleData.title ?? ''}
type=${classification.type}
category=${classification.category ?? 'null'}
text=${text.length > 700 ? text.substring(0, 700) : text}`;

      const metricsContext = {
        isThreat: classification.type === 'threat',
        textSignals: `${(articleData.title ?? '').toLowerCase()}\n${text.toLowerCase()}`,
        inferredCountry,
      };

      let metricsRaw: string | null = null;
      let metricsError: string | null = null;
      let metrics: ThreatMetricsResult = normalizeThreatMetrics(
        null,
        inferredCountry,
        metricsContext,
      );

      if (classification.type === 'news') {
        metricsError = 'Skipped metrics LLM for news article';
      } else if (skipMetricsLlm) {
        metricsError = `Skipped metrics LLM because classification failed: ${llmError}`;
      } else {
        const prompts = [metricsPrompt, metricsPromptShort];
        let lastMetricsErr: string | null = null;
        for (const prompt of prompts) {
          for (let attempt = 0; attempt < 3; attempt += 1) {
            try {
              const response = await withTimeout(
                () => this.chatOpenAI.invoke(prompt),
                this.classifierTimeoutMs,
                `Metrics request for ${url}`,
              );
              metricsRaw = normalizeModelContent(response?.content);
              if (!metricsRaw) throw new Error('Empty model content');
              const parsed = extractJsonObjectFromText(metricsRaw);
              if (!isRecord(parsed)) throw new Error('Invalid JSON');
              metrics = normalizeThreatMetrics(
                parsed,
                inferredCountry,
                metricsContext,
              );
              lastMetricsErr = null;
              break;
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              lastMetricsErr = msg;
              if (!shouldRetryClassificationError(msg)) break;
              await sleep(250 * (attempt + 1));
            }
          }
          if (lastMetricsErr === null) break;
        }
        metricsError = lastMetricsErr;
      }

      const interpretationPrompt = `
Верни ровно один JSON в одну строку. Без Markdown.

Задача: извлечь признаки из киберинцидента для последующего сопоставления с эталонной БД CVE/NVD.
Не придумывай vendor/product/CVE, если их нет в тексте.

Схема:
{"cve_mentions":[string],"vendor_candidates":[string],"product_candidates":[string],"technology_terms":[string],"attack_techniques":[string],"asset_type":string|null,"threat_actor":string|null,"malware_family":string|null,"evidence_tokens":[string],"interpretation_summary":string}

Правила:
- cve_mentions: только реальные CVE вида CVE-YYYY-NNNN.
- vendor_candidates: вендоры/организации/платформы, прямо упомянутые в статье.
- product_candidates: продукты, сервисы, решения, платформы, прямо упомянутые в статье.
- technology_terms: 3-8 технических терминов для поиска по эталонной базе.
- attack_techniques: короткие фразы наподобие "remote code execution", "credential theft", "phishing email", "token leakage".
- asset_type: сервер|веб-приложение|почта|VPN|SCADA|IAM|endpoint|cloud workload|network appliance|database|account|null.
- threat_actor: название группы/кампании, если прямо указано.
- malware_family: название вредоносного ПО/бэкдора/ботнета, если прямо указано.
- evidence_tokens: самые важные токены/артефакты из текста, которые помогают матчингу.
- interpretation_summary: коротко на русском, почему эту угрозу можно сопоставлять с эталонной БД.

Вход:
title=${articleData.title ?? ''}
type=${classification.type}
category=${classification.category ?? 'null'}
subcategory=${classification.subcategory ?? 'null'}
text=${snippet}
      `;

      const interpretationPromptShort = `
Один JSON в одну строку. Только факты из текста, ничего не выдумывай.
{"cve_mentions":[string],"vendor_candidates":[string],"product_candidates":[string],"technology_terms":[string],"attack_techniques":[string],"asset_type":string|null,"threat_actor":string|null,"malware_family":string|null,"evidence_tokens":[string],"interpretation_summary":string}
title=${articleData.title ?? ''}
category=${classification.category ?? 'null'}
text=${text.length > 700 ? text.substring(0, 700) : text}
      `;

      let interpretationRaw: string | null = null;
      let interpretationError: string | null = null;
      let interpretationSignals = normalizeInterpretationSignals(null, {
        title: articleData.title ?? '',
        text,
        category: classification.category,
      });

      if (classification.type === 'news') {
        interpretationError = 'Skipped interpretation for news article';
      } else if (skipMetricsLlm) {
        interpretationError = `Skipped interpretation LLM because classification failed: ${llmError}`;
      } else {
        const interpretationPrompts = [
          interpretationPrompt,
          interpretationPromptShort,
        ];
        let lastInterpretationError: string | null = null;
        for (const prompt of interpretationPrompts) {
          for (let attempt = 0; attempt < 3; attempt += 1) {
            try {
              const response = await withTimeout(
                () => this.chatOpenAI.invoke(prompt),
                this.classifierTimeoutMs,
                `Interpretation request for ${url}`,
              );
              interpretationRaw = normalizeModelContent(response?.content);
              if (!interpretationRaw) throw new Error('Empty model content');
              const parsed = extractJsonObjectFromText(interpretationRaw);
              interpretationSignals = normalizeInterpretationSignals(parsed, {
                title: articleData.title ?? '',
                text,
                category: classification.category,
              });
              lastInterpretationError = null;
              break;
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              lastInterpretationError = msg;
              if (!shouldRetryClassificationError(msg)) break;
              await sleep(250 * (attempt + 1));
            }
          }
          if (lastInterpretationError === null) break;
        }
        interpretationError = lastInterpretationError;
      }

      const interpretationResult =
        classification.type === 'threat'
          ? await this.referenceIntelService.interpretThreat({
              title: articleData.title ?? '',
              text,
              category: translateCategoryToRussian(classification.category),
              subcategory: translateSubcategoryToRussian(
                classification.subcategory,
              ),
              severity: classification.severity,
              classification_reasoning: classification.reasoning,
              attack_vector: metrics.attack_vector,
              target_sector: metrics.target_sector,
              cve_mentions: interpretationSignals.cve_mentions,
              vendor_candidates: interpretationSignals.vendor_candidates,
              product_candidates: interpretationSignals.product_candidates,
              technology_terms: interpretationSignals.technology_terms,
              attack_techniques: interpretationSignals.attack_techniques,
              asset_type: interpretationSignals.asset_type,
              threat_actor: interpretationSignals.threat_actor,
              malware_family: interpretationSignals.malware_family,
            })
          : { grounding_score: 0, matches: [] };

      try {
        fs.mkdirSync(path.dirname(metricsLogPath), { recursive: true });
        fs.appendFileSync(
          metricsLogPath,
          `${JSON.stringify({
            ts: new Date().toISOString(),
            url,
            source: sourceName,
            title: articleData.title ?? '',
            inferred_country: inferredCountry,
            has_threat_signals: hasThreatSignals,
            classification_type: classification.type,
            classification_category: classification.category,
            metrics_error: metricsError,
            metrics_raw: metricsRaw ?? '',
            interpretation_error: interpretationError,
            interpretation_raw: interpretationRaw ?? '',
            interpretation_cves: interpretationSignals.cve_mentions,
            interpretation_grounding_score:
              interpretationResult.grounding_score,
            ...metrics,
          })}\n`,
          'utf8',
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`Failed to write metrics log: ${message}`);
      }

      const vulnSignals = `${articleData.title ?? ''}\n${text}`.toLowerCase();
      const hasVulnSignals =
        vulnSignals.includes('cve') ||
        vulnSignals.includes('0-day') ||
        vulnSignals.includes('zero-day') ||
        vulnSignals.includes('уязвим') ||
        vulnSignals.includes('эксплойт') ||
        vulnSignals.includes('rce');

      const normalizedVulnType =
        classification.category === 'Vulnerabilities & Exploits' &&
        hasVulnSignals
          ? (() => {
              const v = classification.vulnerability_type ?? null;
              if (v === null) return null;
              if (v === 'null') return null;
              return v;
            })()
          : null;

      if (classification.type === 'news') {
        classification.severity = null;
      }

      const storedCategory = translateCategoryToRussian(classification.category);
      const storedSubcategory = translateSubcategoryToRussian(
        classification.subcategory,
      );

      const logPath =
        this.configService.get<string>('CRAWLER_CLASSIFICATION_LOG_PATH') ??
        path.join(process.cwd(), 'tmp', 'classification_results.jsonl');
      try {
        fs.mkdirSync(path.dirname(logPath), { recursive: true });
        fs.appendFileSync(
          logPath,
          `${JSON.stringify({
            ts: new Date().toISOString(),
            url,
            source: sourceName,
            hasThreatSignals,
            title: articleData.title ?? '',
            model_used: modelUsed,
            llm_error: llmError,
            model_raw: modelRaw,
            country: inferredCountry,
            type: classification.type,
            category: storedCategory,
            severity: classification.severity,
            vulnerability_type:
              normalizedVulnType === undefined ? null : normalizedVulnType,
            reasoning: classification.reasoning,
          })}\n`,
          'utf8',
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`Failed to write classification log: ${message}`);
      }

      if (dryRun) return null;

      const publishedAtRaw = articleData.publishedAt ?? null;
      const publishedAt =
        typeof publishedAtRaw === 'string'
          ? new Date(publishedAtRaw)
          : new Date();

      const newArticle = new this.articleModel({
        url: url,
        source: sourceName,
        title: articleData.title ?? 'No Title',
        text: articleData.text ?? 'No Text',
        publishedAt,
        author: articleData.author ?? 'Unknown',
        type: classification.type,
        category: storedCategory,
        subcategory: storedSubcategory,
        severity: classification.severity,
        country: inferredCountry,
        classification_reasoning: classification.reasoning,
        target_sector: metrics.target_sector,
        sub_sector: metrics.sub_sector,
        attack_scale: metrics.attack_scale,
        region: metrics.region,
        attack_vector: metrics.attack_vector,
        exposure_required: metrics.exposure_required,
        user_interaction: metrics.user_interaction,
        complexity: metrics.complexity,
        exploit_available: metrics.exploit_available,
        privileges_required: metrics.privileges_required,
        impact_confidentiality: metrics.impact_confidentiality,
        impact_integrity: metrics.impact_integrity,
        impact_availability: metrics.impact_availability,
        active_exploitation: metrics.active_exploitation,
        time_to_exploit: metrics.time_to_exploit,
        llm_confidence: metrics.llm_confidence,
        extracted_at: new Date(metrics.extracted_at),
        cve_mentions: interpretationSignals.cve_mentions,
        vendor_candidates: interpretationSignals.vendor_candidates,
        product_candidates: interpretationSignals.product_candidates,
        technology_terms: interpretationSignals.technology_terms,
        attack_techniques: interpretationSignals.attack_techniques,
        asset_type: interpretationSignals.asset_type,
        threat_actor: interpretationSignals.threat_actor,
        malware_family: interpretationSignals.malware_family,
        evidence_tokens: interpretationSignals.evidence_tokens,
        interpretation_summary: interpretationSignals.interpretation_summary,
        interpretation_grounding_score:
          interpretationResult.grounding_score,
        interpreted_reference_matches: interpretationResult.matches,
      });

      // сохранение в MongoDB
      await newArticle.save();
      this.logger.log(
        `Статья сохранена: ${newArticle.title} (${newArticle.url})`,
      );

      if (this.disableEmbeddings) {
        this.logger.log(
          `Пропускаем эмбеддинги для ${newArticle.url}: CRAWLER_DISABLE_EMBEDDINGS=1`,
        );
      } else {
        try {
        // Ошибки эмбеддингов не должны откатывать уже сохраненную статью.
        const textForEmbedding = `${newArticle.title}. ${newArticle.text}`;
        const truncatedText = textForEmbedding.substring(
          0,
          Math.min(textForEmbedding.length, 2000),
        );
        this.logger.log(
          `Truncated text length for embedding: ${truncatedText.length}. First 100 chars: ${truncatedText.substring(0, 100)}`,
        );
        const embeddingVector = await withTimeout(
          () => this.embeddings.embedQuery(truncatedText),
          this.embeddingTimeoutMs,
          `Embedding request for ${newArticle.url}`,
        );
        this.logger.log(
          `Qdrant upsert batch payload: ${JSON.stringify({
            ids: [newArticle._id.toHexString()],
            vectors: [embeddingVector],
            payloads: [
              {
                url: newArticle.url,
                title: newArticle.title,
                source: newArticle.source,
                publishedAt: newArticle.publishedAt.toISOString(),
              },
            ],
          })}`,
        );

        await withTimeout(
          () =>
            this.qdrantClient.upsert('articles', {
              wait: true,
              points: [
                {
                  id: newArticle._id.toHexString(),
                  vector: embeddingVector,
                  payload: {
                    articleId: newArticle._id.toHexString(),
                    url: newArticle.url,
                    title: newArticle.title,
                    source: newArticle.source,
                    type: newArticle.type,
                    category: newArticle.category,
                    severity: newArticle.severity,
                    country: newArticle.country,
                    publishedAt: newArticle.publishedAt.toISOString(),
                  },
                },
              ],
            }),
          this.embeddingTimeoutMs,
          `Qdrant upsert for ${newArticle.url}`,
        );
        this.logger.log(
          `Эмбеддинг для статьи "${newArticle.title}" добавлен в Qdrant.`,
        );
        } catch (embeddingError: unknown) {
          const embeddingMessage =
            embeddingError instanceof Error
              ? embeddingError.message
              : String(embeddingError);
          this.logger.error(
            `Статья сохранена, но постобработка эмбеддинга не удалась для ${newArticle.url}: ${embeddingMessage}`,
          );
        }
      }

      return newArticle; // Return the saved article
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Ошибка при парсинге или сохранении статьи ${url}: ${message}`,
      );

      if (isRecord(error) && isRecord(error['response'])) {
        const response = error['response'];
        this.logger.error(
          `OpenRouter API response data: ${JSON.stringify(response['data'])}`,
        );
        this.logger.error(
          `OpenRouter API response status: ${JSON.stringify(response['status'])}`,
        );
        this.logger.error(
          `OpenRouter API response headers: ${JSON.stringify(response['headers'])}`,
        );
      }
      return null; // Return null on error
    } finally {
      this.inFlightUrls.delete(url);
    }
  }
}
