import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { ChatOpenAI } from '@langchain/openai';
import { Model } from 'mongoose';
import { THREAT_CONTROL_SECTIONS, ThreatSourceType } from './threat-controls';
import { ModelObjectEntity } from '../model-objects/model-object.schema';

type AnyRecord = Record<string, unknown>;

function isRecord(value: unknown): value is AnyRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeReferenceMatches(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (!isRecord(item)) return '';
      const source =
        typeof item.source === 'string' ? item.source.trim() : 'N/A';
      const reference =
        typeof item.reference_id === 'string'
          ? item.reference_id.trim()
          : typeof item.referenceId === 'string'
            ? item.referenceId.trim()
            : 'unknown';
      const rationale =
        typeof item.rationale === 'string' ? item.rationale.trim() : '';
      const score =
        typeof item.score === 'number' && Number.isFinite(item.score)
          ? ` score=${item.score.toFixed(3)}`
          : '';
      return `${source}:${reference}${score}${rationale ? ` (${rationale})` : ''}`.trim();
    })
    .filter(Boolean)
    .slice(0, 30);
}

function normalizeJsonFromText(content: unknown): unknown {
  const text =
    typeof content === 'string'
      ? content
      : Array.isArray(content)
        ? content
            .map((part) => (isRecord(part) && typeof part.text === 'string' ? part.text : ''))
            .join('\n')
        : '';
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fenced?.[1]) {
      try {
        return JSON.parse(fenced[1]);
      } catch {
        return null;
      }
    }
    const left = text.indexOf('{');
    const right = text.lastIndexOf('}');
    if (left >= 0 && right > left) {
      try {
        return JSON.parse(text.slice(left, right + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function withTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | null = null;
  try {
    return await Promise.race([
      fn(),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`timeout after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

@Injectable()
export class ModelThreatService {
  private readonly logger = new Logger(ModelThreatService.name);
  private readonly llm: ChatOpenAI;
  private readonly tgLlm: ChatOpenAI;

  constructor(
    private readonly configService: ConfigService,
    @InjectModel('ModelThreatWeb') private readonly modelThreatWeb: Model<any>,
    @InjectModel('ModelThreatTg') private readonly modelThreatTg: Model<any>,
    @InjectModel('ModelThreatForum') private readonly modelThreatForum: Model<any>,
    @InjectModel(ModelObjectEntity.name) private readonly modelObjectModel: Model<ModelObjectEntity>,
  ) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY') || '';
    const apiBase =
      this.configService.get<string>('OPENAI_API_BASE') ||
      'https://openrouter.ai/api/v1';
    const model =
      this.configService.get<string>('OPENAI_MODEL') ||
      this.configService.get<string>('OPENROUTER_MODEL') ||
      'openrouter/free';

    this.llm = new ChatOpenAI({
      apiKey,
      configuration: { baseURL: apiBase },
      model,
      temperature: 0.1,
    });

    const tgApiKey =
      this.configService.get<string>('TG_OPENAI_API_KEY') || apiKey;
    const tgApiBase =
      this.configService.get<string>('TG_OPENAI_BASE_URL') || apiBase;
    const tgModel =
      this.configService.get<string>('TG_OPENROUTER_CLASSIFIER_MODEL') ||
      model;

    this.tgLlm = new ChatOpenAI({
      apiKey: tgApiKey,
      configuration: { baseURL: tgApiBase },
      model: tgModel,
      temperature: 0.1,
    });
  }

  private getTargetModel(source: ThreatSourceType): Model<any> {
    if (source === 'web') return this.modelThreatWeb;
    if (source === 'tg') return this.modelThreatTg;
    return this.modelThreatForum;
  }

  private getArticleCollectionName(source: ThreatSourceType): string {
    if (source === 'web') return 'model_threat_web';
    if (source === 'tg') return 'tg_raw_messages';
    return 'model_threat_forum_raw';
  }

  private getLlm(source: ThreatSourceType): ChatOpenAI {
    return source === 'tg' ? this.tgLlm : this.llm;
  }

  private buildObjectControlsProfile(objects: any[]): string {
    const controls: Record<string, { enabled: number; disabled: number; details: Set<string> }> = {};
    for (const section of THREAT_CONTROL_SECTIONS) {
      for (const control of section.controls) {
        controls[`${section.key}.${control}`] = {
          enabled: 0,
          disabled: 0,
          details: new Set<string>(),
        };
      }
    }

    for (const objectItem of objects) {
      const depth = isRecord((objectItem as any).depth) ? ((objectItem as any).depth as AnyRecord) : {};
      for (const section of THREAT_CONTROL_SECTIONS) {
        const sectionData = isRecord(depth[section.key]) ? (depth[section.key] as AnyRecord) : {};
        for (const control of section.controls) {
          const value = Boolean(sectionData[control]);
          const bucket = controls[`${section.key}.${control}`];
          if (value) bucket.enabled += 1;
          else bucket.disabled += 1;
        }
        for (const detailKey of section.details || []) {
          const raw = sectionData[detailKey];
          if (typeof raw === 'string' && raw.trim()) {
            for (const token of raw.split(/[,\n;/|]/g).map((x) => x.trim()).filter(Boolean)) {
              if (token.length > 2) {
                for (const control of section.controls) {
                  controls[`${section.key}.${control}`].details.add(token);
                }
              }
            }
          }
        }
      }
    }

    return Object.entries(controls)
      .map(([key, value]) => {
        const details = Array.from(value.details).slice(0, 12);
        return `${key}: enabled=${value.enabled}, disabled=${value.disabled}, detail_terms=[${details.join(', ')}]`;
      })
      .join('\n');
  }

  private buildForumTextContext(text: string): string {
    const lines = text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !/^[-=*#]{2,}$/.test(line))
      .filter((line) => line.length >= 18);

    const dedup = Array.from(new Set(lines));
    const head = dedup.slice(0, 18);
    const tail = dedup.slice(-8);
    const merged = [...head, ...tail];
    const joined = merged.join('\n');
    return joined.length > 5000 ? `${joined.slice(0, 3500)}\n...\n${joined.slice(-1200)}` : joined;
  }

  private buildPrompt(
    article: any,
    objectProfile: string,
    source: ThreatSourceType,
  ): string {
    const structure: Record<string, any> = {};
    for (const section of THREAT_CONTROL_SECTIONS) {
      const sectionOut: Record<string, any> = {};
      for (const control of section.controls) sectionOut[control] = false;
      for (const detailKey of section.details || []) sectionOut[detailKey] = [];
      structure[section.key] = sectionOut;
    }

    return `
Ты аналитик киберугроз. Ответь строго JSON без markdown.
Первый шаг: определи тип материала.
- content_kind = "threat" только если описана реальная киберугроза/атака/эксплуатация/утечка/вредоносная активность.
- content_kind = "news" если это общий инфоповод, комментарий, аналитика, релиз, обзор, политика, контекст без явной угрозы.
Важное правило: если контент больше похож на новость, чем на активную угрозу, выбери "news".
Задача: определить, при отсутствии каких мер защиты угроза из статьи особенно опасна для объекта КИИ.
Логика: true у чекбокса означает "если на объекте НЕТ этой меры, риск заметно растёт".
Для полей-уточнений (ПО/оборудование) верни список терминов/вендоров/продуктов из угрозы, если они критичны.
Оцени severity ТОЛЬКО если content_kind="threat":
- high: активная эксплуатация/0day/RCE/ransomware/массовая кампания/высокий ущерб.
- medium: подтверждённая уязвимость, phishing, malware, утечка с ограниченным охватом.
- low: слабые индикаторы угрозы или ограниченный технический импакт.
- null: только для news.

Профиль текущих объектов (сводно):
${objectProfile}

Материал:
title=${article.title ?? ''}
source=${article.source ?? ''}
category=${article.category ?? ''}
subcategory=${article.subcategory ?? ''}
severity=${article.severity ?? ''}
text=${
      source === 'forum'
        ? this.buildForumTextContext(String(article.text ?? ''))
        : String(article.text ?? '').slice(0, 8000)
    }

${source === 'forum'
        ? `Дополнение для forum-источника:
- Текст может быть диалогом и содержать шум.
- Считай "threat" только если есть технические признаки угрозы (эксплуатация, IOC, CVE, утечка, вредоносная активность, подтвержденный инцидент).
- Если это обсуждение без конкретики или пересказ новости без технического сигнала, верни "news".`
        : ''}

Верни JSON вида:
{
  "content_kind": "news|threat",
  "severity": "high|medium|low|null",
  "summary_ru": "краткая выжимка угрозы на русском",
  "country": "страна или Global",
  "attack_vector": "web|email|network|endpoint|cloud|identity|unknown",
  "threat_actor": "actor name or unknown",
  "technology_terms": [string],
  "vendor_candidates": [string],
  "product_candidates": [string],
  "cve_mentions": [string],
  "attack_techniques": [string],
  "targeted_levels": [string],
  "signal_terms": [string],
  "reasoning": string,
  "depth": ${JSON.stringify(structure)}
}
`;
  }

  private normalizeOutput(raw: unknown): {
    content_kind: 'news' | 'threat';
    targeted_levels: string[];
    signal_terms: string[];
    reasoning: string;
    depth: Record<string, any>;
    analysis: Record<string, unknown>;
  } {
    const baseDepth: Record<string, any> = {};
    for (const section of THREAT_CONTROL_SECTIONS) {
      baseDepth[section.key] = {};
      for (const control of section.controls) baseDepth[section.key][control] = false;
      for (const detailKey of section.details || []) baseDepth[section.key][detailKey] = [];
    }

    const parsed = isRecord(raw) ? raw : {};
    const depthRaw = isRecord(parsed.depth) ? (parsed.depth as AnyRecord) : {};
    for (const section of THREAT_CONTROL_SECTIONS) {
      const sectionRaw = isRecord(depthRaw[section.key]) ? (depthRaw[section.key] as AnyRecord) : {};
      for (const control of section.controls) {
        baseDepth[section.key][control] = Boolean(sectionRaw[control]);
      }
      for (const detailKey of section.details || []) {
        const detailRaw = sectionRaw[detailKey];
        const list = Array.isArray(detailRaw)
          ? detailRaw.map((x) => String(x).trim()).filter(Boolean)
          : typeof detailRaw === 'string'
            ? detailRaw.split(/[,\n;/|]/g).map((x) => x.trim()).filter(Boolean)
            : [];
        baseDepth[section.key][detailKey] = list.slice(0, 20);
      }
    }

    return {
      content_kind: parsed.content_kind === 'news' ? 'news' : 'threat',
      targeted_levels: Array.isArray(parsed.targeted_levels)
        ? parsed.targeted_levels.map((x) => String(x).trim()).filter(Boolean).slice(0, 20)
        : [],
      signal_terms: Array.isArray(parsed.signal_terms)
        ? parsed.signal_terms.map((x) => String(x).trim()).filter(Boolean).slice(0, 40)
        : [],
      reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning.slice(0, 2000) : '',
      depth: baseDepth,
      analysis: {
        severity: (() => {
          const rawSeverity =
            typeof parsed.severity === 'string' ? parsed.severity.trim().toLowerCase() : '';
          if (rawSeverity === 'high' || rawSeverity === 'critical') return 'high';
          if (rawSeverity === 'medium' || rawSeverity === 'moderate') return 'medium';
          if (rawSeverity === 'low') return 'low';
          if (rawSeverity === 'высокий' || rawSeverity === 'высокая') return 'high';
          if (rawSeverity === 'средний' || rawSeverity === 'средняя') return 'medium';
          if (rawSeverity === 'низкий' || rawSeverity === 'низкая') return 'low';
          return null;
        })(),
        summary_ru:
          typeof parsed.summary_ru === 'string' ? parsed.summary_ru.slice(0, 4000) : '',
        country:
          typeof parsed.country === 'string' && parsed.country.trim()
            ? parsed.country.trim().slice(0, 120)
            : null,
        attack_vector:
          typeof parsed.attack_vector === 'string'
            ? parsed.attack_vector.trim().slice(0, 120)
            : null,
        threat_actor:
          typeof parsed.threat_actor === 'string'
            ? parsed.threat_actor.trim().slice(0, 300)
            : null,
        technology_terms: Array.isArray(parsed.technology_terms)
          ? parsed.technology_terms
              .map((x) => String(x).trim())
              .filter(Boolean)
              .slice(0, 30)
          : [],
        vendor_candidates: Array.isArray(parsed.vendor_candidates)
          ? parsed.vendor_candidates
              .map((x) => String(x).trim())
              .filter(Boolean)
              .slice(0, 30)
          : [],
        product_candidates: Array.isArray(parsed.product_candidates)
          ? parsed.product_candidates
              .map((x) => String(x).trim())
              .filter(Boolean)
              .slice(0, 30)
          : [],
        cve_mentions: Array.isArray(parsed.cve_mentions)
          ? parsed.cve_mentions
              .map((x) => String(x).trim())
              .filter(Boolean)
              .slice(0, 30)
          : [],
        attack_techniques: Array.isArray(parsed.attack_techniques)
          ? parsed.attack_techniques
              .map((x) => String(x).trim())
              .filter(Boolean)
              .slice(0, 30)
          : [],
      },
    };
  }

  private hasAnyControlTrue(depth: Record<string, any>): boolean {
    for (const section of THREAT_CONTROL_SECTIONS) {
      const sectionValue = depth?.[section.key] || {};
      for (const control of section.controls) {
        if (sectionValue[control] === true) return true;
      }
    }
    return false;
  }

  private inferCategoryFromText(
    title: string,
    text: string,
  ): { category: string | null; subcategory: string | null } {
    const t = `${title}\n${text}`.toLowerCase();
    if (
      /(взлом|взломан|взломали|hacked|hack|deface|дефейс|компрометац|breach|incident)/i.test(
        t,
      )
    ) {
      return { category: 'Сетевые атаки', subcategory: null };
    }
    if (/(cve|0-day|zero-day|эксплойт|rce|уязвим)/i.test(t)) {
      return { category: 'Уязвимости и эксплуатация', subcategory: null };
    }
    if (/(phishing|фишинг|spear|smishing|vishing|имперсонац)/i.test(t)) {
      return { category: 'Фишинг', subcategory: null };
    }
    if (/(malware|ransomware|botnet|spyware|trojan|вредонос|шифровальщик)/i.test(t)) {
      return { category: 'Вредоносное ПО', subcategory: null };
    }
    if (/(утеч|data breach|leak|dump|credential exposure|компрометац учет)/i.test(t)) {
      return { category: 'Утечки данных', subcategory: null };
    }
    if (/(ddos|dns attack|bgp|сканирован|network attack)/i.test(t)) {
      return { category: 'Сетевые атаки', subcategory: null };
    }
    if (/(supply chain|dependency|package|npm|nuget|poisoned update)/i.test(t)) {
      return { category: 'Атаки на цепочку поставок', subcategory: null };
    }
    if (/(apt|кибершпионаж|nation-state|госструктур)/i.test(t)) {
      return { category: 'APT-активность', subcategory: null };
    }
    if (/(fraud|мошеннич|account takeover|crypto scam)/i.test(t)) {
      return { category: 'Мошенничество', subcategory: null };
    }
    if (/(cloud|iam|token|saas|облачн)/i.test(t)) {
      return { category: 'Облачная безопасность', subcategory: null };
    }
    if (/(scada|ics|industrial|критическ инфраструктур)/i.test(t)) {
      return { category: 'Промышленные и киберфизические атаки', subcategory: null };
    }
    return { category: null, subcategory: null };
  }

  private buildHeuristicOutput(article: any): {
    content_kind: 'news' | 'threat';
    targeted_levels: string[];
    signal_terms: string[];
    reasoning: string;
    depth: Record<string, any>;
    analysis: Record<string, unknown>;
  } {
    const text = `${article?.title ?? ''}\n${article?.text ?? ''}`.toLowerCase();
    const depth: Record<string, any> = {};
    for (const section of THREAT_CONTROL_SECTIONS) {
      depth[section.key] = {};
      for (const control of section.controls) depth[section.key][control] = false;
      for (const detail of section.details || []) depth[section.key][detail] = [];
    }

    const mark = (section: string, controls: string[]) => {
      for (const control of controls) {
        depth[section][control] = true;
      }
    };

    if (/(cisco|juniper|маршрутиз|коммутатор|router|switch|bgp|vlan|network)/i.test(text)) {
      mark('network', ['vlan', 'segmentation', 'acl', 'switchProtection', 'trafficAnalysis']);
      depth.network.networkEquipment = ['Cisco', 'Juniper'];
    }
    if (/(vpn|firewall|dmz|ids|ips|ddos|port scan|сканировани)/i.test(text)) {
      mark('perimeter', ['firewall', 'vpn', 'idsIps', 'publishedPortsControl', 'anomalyDetection']);
    }
    if (/(ransomware|malware|virus|edr|endpoint|patch|уязвим|cve)/i.test(text)) {
      mark('endpoints', ['antivirus', 'edrXdr', 'patchManagement', 'hardening']);
    }
    if (/(sql injection|xss|rce|api|waf|owasp)/i.test(text)) {
      mark('applications', ['waf', 'inputValidation', 'sastDast', 'secureSdlc']);
    }
    if (/(password|credential|mfa|account|auth|rbac)/i.test(text)) {
      mark('iam', ['mfa', 'passwordPolicy', 'rbac', 'leastPrivilege']);
    }
    if (/(leak|data breach|encryption|tls|backup|exfiltration|утечк)/i.test(text)) {
      mark('data', ['storageEncryption', 'backup', 'tls', 'dataAccessControl']);
    }
    if (/(siem|soc|incident|log|detection|monitoring)/i.test(text)) {
      mark('monitoringResponse', ['siem', 'soc', 'irProcedures', 'centralizedLogs']);
    }
    if (/(email|почт|account|аккаунт|credential|учетн|mobile|телефон|sms|sim swap|mfa bypass)/i.test(text)) {
      mark('iam', ['mfa', 'passwordPolicy', 'rbac', 'userLifecycle']);
      mark('endpoints', ['edrXdr', 'softwareControl']);
      mark('data', ['tls', 'dataAccessControl']);
    }

    const targeted_levels = Object.keys(depth).filter((key) =>
      Object.entries(depth[key]).some(([k, v]) => k !== 'controls' && v === true),
    );
    const signal_terms = ['cve', 'exploit', 'rce', 'credentials', 'cisco', 'vpn'].filter((t) =>
      text.includes(t),
    );

    const strongIndicators = [
      /cve-\d{4}-\d+/i,
      /\b(cve|exploit|rce|0-day|zero-day)\b/i,
      /\b(ransomware|malware|trojan|stealer|botnet)\b/i,
      /\b(sql injection|xss|command injection|deserialization)\b/i,
      /(эксплойт|шифровальщик|вредонос|ботнет)/i,
    ];
    const weakIndicators = [
      /\b(hack|hacked|breach|leak|phishing|ddos)\b/i,
      /(взлом|утечк|фишинг|компрометац|атака)/i,
    ];
    const strongHits = strongIndicators.reduce((acc, rx) => acc + (rx.test(text) ? 1 : 0), 0);
    const weakHits = weakIndicators.reduce((acc, rx) => acc + (rx.test(text) ? 1 : 0), 0);
    const suspicious = strongHits >= 1 || weakHits >= 1;

    const severity = (() => {
      if (!suspicious) return null;
      if (/(ransomware|шифровальщик|0-day|zero-day|rce|массов|критич|critical)/i.test(text)) {
        return 'high';
      }
      if (/(cve|эксплойт|утечк|взлом|ddos|malware|botnet|фишинг)/i.test(text)) {
        return 'medium';
      }
      return 'low';
    })();

    return {
      content_kind: suspicious ? 'threat' : 'news',
      targeted_levels,
      signal_terms,
      reasoning:
        'Эвристическая оценка: уровни защиты отмечены по ключевым индикаторам угрозы в заголовке и тексте.',
      depth,
      analysis: {
        severity,
        summary_ru: '',
        country: null,
        attack_vector: null,
        threat_actor: null,
        technology_terms: [],
        vendor_candidates: [],
        product_candidates: [],
        cve_mentions: [],
        attack_techniques: [],
      },
    };
  }

  private deriveSeverity(
    article: any,
    normalized: ReturnType<ModelThreatService['normalizeOutput']>,
  ): 'high' | 'medium' | 'low' | null {
    const llmSeverity = normalized.analysis.severity;
    const rawSeverity =
      typeof article.severity === 'string' ? article.severity.trim().toLowerCase() : '';
    const text = `${article?.title ?? ''}\n${article?.text ?? ''}`.toLowerCase();

    let score = 0;
    if (/\bcve-\d{4}-\d+\b/i.test(text)) score += 2;
    if (/\b(0-day|zero-day|rce|remote code execution)\b/i.test(text)) score += 4;
    if (/(эксплойт|эксплуатац|rce|0day|нулевого дня)/i.test(text)) score += 3;
    if (/\b(ransomware|шифровальщик|wiper|botnet|stealer)\b/i.test(text)) score += 4;
    if (/(взлом|утечк|компрометац|массов|атака|ddos|фишинг)/i.test(text)) score += 2;
    if (
      /(взлом.*инфраструктур|полный доступ|domain admin|privilege escalation|массов(ая|ой)? утечк|миллион(ов)? запис|данные клиент(ов|а).*(утек|слит))/i.test(
        text,
      )
    ) {
      score += 3;
    }
    if (/(critical infrastructure|критическ(ой|ая)? инфраструктур|энергетик|медицин|гос)/i.test(text)) score += 2;
    if (/(patch|исправил|обновлени|mitigation|рекомендац)/i.test(text)) score -= 1;

    const scoredSeverity: 'high' | 'medium' | 'low' | null =
      score >= 7 ? 'high' : score >= 2 ? 'medium' : score >= 1 ? 'low' : null;

    if (llmSeverity === 'high' || llmSeverity === 'medium' || llmSeverity === 'low') {
      if (llmSeverity === 'low' && scoredSeverity === 'high') return 'medium';
      if (llmSeverity === 'high' && scoredSeverity === 'low') return 'medium';
      if (llmSeverity === 'medium' && scoredSeverity) return scoredSeverity;
      return llmSeverity;
    }

    if (rawSeverity === 'high' || rawSeverity === 'medium' || rawSeverity === 'low') {
      if (scoredSeverity === null) return rawSeverity as 'high' | 'medium' | 'low';
      if (rawSeverity === scoredSeverity) return rawSeverity as 'high' | 'medium' | 'low';
      return scoredSeverity;
    }

    return scoredSeverity;
  }

  async list(source: ThreatSourceType) {
    return this.getTargetModel(source).find().sort({ publishedAt: -1 }).lean().exec();
  }

  async clearSource(source: ThreatSourceType) {
    const targetModel = this.getTargetModel(source);
    const result = await targetModel.deleteMany({});
    return { source, deleted: result.deletedCount ?? 0 };
  }

  async clearAll() {
    const web = await this.clearSource('web');
    const tg = await this.clearSource('tg');
    const forum = await this.clearSource('forum');
    return { web, tg, forum };
  }

  async rebuildSource(source: ThreatSourceType, limit = 150) {
    const objectItems = await this.modelObjectModel.find().lean().exec();
    const objectProfile = this.buildObjectControlsProfile(objectItems);

    const sourceCollectionName = this.getArticleCollectionName(source);
    const targetCollectionName =
      source === 'web'
        ? 'model_threat_web'
        : source === 'tg'
          ? 'model_threat_tg'
          : 'model_threat_forum';
    const articleCollection =
      this.modelThreatWeb.db.collection(sourceCollectionName);
    const articles = await articleCollection
      .find({})
      .sort({ publishedAt: -1 })
      .limit(Math.max(1, Math.min(limit, 500)))
      .toArray();

    const targetModel = this.getTargetModel(source);
    let processed = 0;
    let failed = 0;
    let llmTemporarilyDisabled = false;
    const llm = this.getLlm(source);
    const llmTimeoutMs = source === 'tg' ? 2500 : 8000;
    const llmBudget = source === 'tg' ? 80 : Number.MAX_SAFE_INTEGER;
    let llmUsed = 0;

    for (const article of articles) {
      try {
        const prompt = this.buildPrompt(article, objectProfile, source);
        let normalized: ReturnType<ModelThreatService['normalizeOutput']>;
        try {
          if (!llmTemporarilyDisabled && llmUsed < llmBudget) {
            const response = await withTimeout(
              () => llm.invoke(prompt),
              llmTimeoutMs,
            );
            llmUsed += 1;
            const parsed = normalizeJsonFromText(response.content);
            normalized = this.normalizeOutput(parsed);
            if (
              normalized.content_kind === 'threat' &&
              !this.hasAnyControlTrue(normalized.depth)
            ) {
              const heuristic = this.buildHeuristicOutput(article);
              normalized = {
                ...normalized,
                content_kind: normalized.content_kind,
                depth: heuristic.depth,
                targeted_levels: normalized.targeted_levels.length
                  ? normalized.targeted_levels
                  : heuristic.targeted_levels,
                signal_terms: normalized.signal_terms.length
                  ? normalized.signal_terms
                  : heuristic.signal_terms,
                reasoning: normalized.reasoning || heuristic.reasoning,
              };
            }
          } else {
            normalized = this.buildHeuristicOutput(article);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (/402|insufficient credits|payment required/i.test(message)) {
            llmTemporarilyDisabled = true;
            this.logger.warn(
              `LLM disabled for current rebuild (${source}) due to quota/payment error`,
            );
          }
          normalized = this.buildHeuristicOutput(article);
        }

        let resolvedCategory =
          typeof article.category === 'string' ? article.category.trim() : '';
        let resolvedSubcategory =
          typeof article.subcategory === 'string'
            ? article.subcategory.trim()
            : '';
        if (!resolvedCategory && normalized.content_kind === 'threat') {
          const inferred = this.inferCategoryFromText(
            String(article.title ?? ''),
            String(article.text ?? ''),
          );
          resolvedCategory = inferred.category ?? '';
          resolvedSubcategory = inferred.subcategory ?? '';
        }
        const hasCategory = resolvedCategory.length > 0;
        const normalizedSeverity = this.deriveSeverity(article, normalized);
        const articleId =
          sourceCollectionName === targetCollectionName
            ? String(article.article_id ?? article._id ?? '')
            : String(article._id ?? '');
        if (!articleId) continue;

        if (normalized.content_kind !== 'threat' || !hasCategory) {
          await targetModel.deleteOne({ article_id: articleId });
          continue;
        }

        await targetModel.updateOne(
          { article_id: articleId },
          {
            $set: {
              article_id: articleId,
              article_collection: sourceCollectionName,
              type: 'threat',
              url: String(article.url ?? ''),
              source: String(article.source ?? ''),
              title: String(article.title ?? ''),
              text: String(article.text ?? ''),
              author:
                typeof article.author === 'string' && article.author.trim()
                  ? article.author.trim()
                  : null,
              publishedAt: article.publishedAt
                ? new Date(article.publishedAt)
                : null,
              category: resolvedCategory || null,
              subcategory: resolvedSubcategory || null,
              severity: normalizedSeverity,
              llm_confidence: Number(article.llm_confidence ?? 0),
              threat_summary:
                String(
                  article.threat_summary ??
                    article.interpretation_summary ??
                    normalized.analysis.summary_ru ??
                    '',
                ).slice(0, 4000),
              interpretation_summary:
                String(
                  article.interpretation_summary ??
                    article.threat_summary ??
                    normalized.analysis.summary_ru ??
                    '',
                ).slice(0, 4000),
              interpretation_grounding_score:
                article.interpretation_grounding_score ?? null,
              interpreted_reference_matches: Array.isArray(article.interpreted_reference_matches)
                ? normalizeReferenceMatches(article.interpreted_reference_matches)
                : [],
              classification_reasoning:
                String(article.classification_reasoning ?? normalized.reasoning ?? '').slice(
                  0,
                  4000,
                ),
              extracted_at: article.extracted_at ?? new Date(),
              country:
                (normalized.analysis.country as string | null) ??
                article.country ??
                null,
              region: article.region ?? null,
              target_sector: article.target_sector ?? null,
              sub_sector: article.sub_sector ?? null,
              asset_type: article.asset_type ?? null,
              attack_vector:
                (normalized.analysis.attack_vector as string | null) ??
                article.attack_vector ??
                null,
              attack_scale: article.attack_scale ?? null,
              attack_techniques: Array.isArray(article.attack_techniques)
                ? article.attack_techniques
                : (normalized.analysis.attack_techniques as string[]) ?? [],
              threat_actor:
                (normalized.analysis.threat_actor as string | null) ??
                article.threat_actor ??
                null,
              malware_family: article.malware_family ?? null,
              cve_mentions: Array.isArray(article.cve_mentions)
                ? article.cve_mentions
                : (normalized.analysis.cve_mentions as string[]) ?? [],
              exploit_available: article.exploit_available ?? null,
              active_exploitation: article.active_exploitation ?? null,
              technology_terms: Array.isArray(article.technology_terms)
                ? article.technology_terms
                : (normalized.analysis.technology_terms as string[]) ?? [],
              vendor_candidates: Array.isArray(article.vendor_candidates)
                ? article.vendor_candidates
                : (normalized.analysis.vendor_candidates as string[]) ?? [],
              product_candidates: Array.isArray(article.product_candidates)
                ? article.product_candidates
                : (normalized.analysis.product_candidates as string[]) ?? [],
              complexity: article.complexity ?? null,
              privileges_required: article.privileges_required ?? null,
              user_interaction: article.user_interaction ?? null,
              exposure_required: article.exposure_required ?? null,
              impact_confidentiality: article.impact_confidentiality ?? null,
              impact_integrity: article.impact_integrity ?? null,
              impact_availability: article.impact_availability ?? null,
              time_to_exploit: article.time_to_exploit ?? null,
              evidence_tokens: Array.isArray(article.evidence_tokens)
                ? article.evidence_tokens
                : [],
              targeted_levels: normalized.targeted_levels,
              signal_terms: normalized.signal_terms,
              reasoning: normalized.reasoning,
              depth: normalized.depth,
              prompt_version: 'v3-kind-first',
            },
          },
          { upsert: true },
        );
        processed += 1;
      } catch (error) {
        failed += 1;
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Threat model rebuild failed for ${source} article ${article?._id}: ${message}`);
      }
    }

    return { source, total: articles.length, processed, failed };
  }

  async rebuildAll(limit = 150) {
    const web = await this.rebuildSource('web', limit);
    const tg = await this.rebuildSource('tg', limit);
    const forum = await this.rebuildSource('forum', limit);
    return { web, tg, forum };
  }
}
