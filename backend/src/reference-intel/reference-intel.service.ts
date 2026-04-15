import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ReferenceCve } from './reference-cve.schema';

type ReferenceMatch = {
  source: 'NVD';
  reference_id: string;
  score: number;
  rationale: string;
  base_score: number | null;
  base_severity: string | null;
  vendors: string[];
  products: string[];
  cwes: string[];
};

export interface ThreatInterpretationInput {
  title: string;
  text: string;
  category: string | null;
  subcategory: string | null;
  severity: string | null;
  classification_reasoning: string;
  attack_vector: string | null;
  target_sector: string | null;
  cve_mentions: string[];
  vendor_candidates: string[];
  product_candidates: string[];
  technology_terms: string[];
  attack_techniques: string[];
  asset_type: string | null;
  threat_actor: string | null;
  malware_family: string | null;
}

export interface ThreatInterpretationResult {
  grounding_score: number;
  matches: ReferenceMatch[];
}

const STOPWORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'that',
  'this',
  'from',
  'into',
  'after',
  'before',
  'about',
  'under',
  'over',
  'news',
  'alert',
  'report',
  'group',
  'campaign',
  'attack',
  'attacks',
  'threat',
  'threats',
  'статья',
  'новость',
  'атака',
  'атаки',
  'угроза',
  'угрозы',
  'сообщили',
  'сообщает',
  'стало',
  'стали',
  'связано',
  'новая',
  'новый',
  'wave',
  'new',
]);

function normalizeText(value: string | null | undefined): string {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function uniqueNormalized(values: Array<string | null | undefined>): string[] {
  const out = new Set<string>();
  values.forEach((value) => {
    const normalized = normalizeText(value);
    if (normalized) out.add(normalized);
  });
  return [...out];
}

function tokenize(text: string): string[] {
  return Array.from(
    new Set(
      normalizeText(text)
        .replace(/[^a-z0-9а-яё+._ -]/gi, ' ')
        .split(/\s+/)
        .map((item) => item.trim())
        .filter((item) => item.length >= 3 && !STOPWORDS.has(item)),
    ),
  );
}

function overlapScore(left: string[], right: string[]): number {
  if (!left.length || !right.length) return 0;
  const rightSet = new Set(right);
  const overlap = left.filter((item) => rightSet.has(item)).length;
  return overlap / Math.max(left.length, right.length);
}

function coverageScore(left: string[], right: string[]): number {
  if (!left.length || !right.length) return 0;
  const rightSet = new Set(right);
  const overlap = left.filter((item) => rightSet.has(item)).length;
  return overlap / left.length;
}

function severityWeight(value: string | null): number {
  switch (normalizeText(value)) {
    case 'critical':
      return 1;
    case 'high':
      return 0.85;
    case 'medium':
      return 0.55;
    case 'low':
      return 0.25;
    default:
      return 0.35;
  }
}

function buildThreatHintTokens(input: ThreatInterpretationInput): string[] {
  const hints = new Set<string>();
  const category = normalizeText(input.category);
  const subcategory = normalizeText(input.subcategory);
  const attackVector = normalizeText(input.attack_vector);
  const assetType = normalizeText(input.asset_type);

  const pushMany = (values: string[]) => {
    values.forEach((value) => {
      const normalized = normalizeText(value);
      if (normalized) hints.add(normalized);
    });
  };

  if (category.includes('вредонос')) {
    pushMany(['malware', 'trojan', 'ransomware', 'loader', 'botnet']);
  }
  if (category.includes('фишинг')) {
    pushMany(['phishing', 'credential', 'email', 'account']);
  }
  if (category.includes('уязвим') || subcategory.includes('cve')) {
    pushMany(['vulnerability', 'rce', 'xss', 'sql', 'deserialization']);
  }
  if (category.includes('утечк')) {
    pushMany(['exposure', 'leak', 'credential', 'dump', 'access']);
  }
  if (category.includes('сетев')) {
    pushMany(['network', 'ddos', 'dns', 'router', 'gateway']);
  }
  if (category.includes('промышлен') || category.includes('киберфиз')) {
    pushMany(['ics', 'scada', 'plc', 'hmi', 'modbus', 'opc']);
  }
  if (category.includes('apt')) {
    pushMany(['apt', 'backdoor', 'loader', 'persistence']);
  }

  if (subcategory.includes('ransom')) pushMany(['ransomware', 'encryptor']);
  if (subcategory.includes('ботнет')) pushMany(['botnet']);
  if (subcategory.includes('шпион')) pushMany(['spyware', 'stealer']);
  if (subcategory.includes('zero-day') || subcategory.includes('нулевого дня')) {
    pushMany(['zero-day', 'rce', 'exploit']);
  }

  if (attackVector === 'network') pushMany(['network', 'remote', 'http', 'web']);
  if (attackVector === 'email') pushMany(['email', 'outlook', 'exchange']);
  if (attackVector === 'physical') pushMany(['physical', 'usb']);

  if (assetType.includes('mail')) pushMany(['email', 'mail', 'exchange']);
  if (assetType.includes('web')) pushMany(['web', 'http', 'nginx', 'apache']);
  if (assetType.includes('vpn')) pushMany(['vpn', 'gateway']);
  if (assetType.includes('ics') || assetType.includes('scada')) {
    pushMany(['ics', 'scada', 'plc', 'hmi']);
  }

  pushMany(input.technology_terms);
  pushMany(input.attack_techniques);
  if (input.threat_actor) pushMany([input.threat_actor]);
  if (input.malware_family) pushMany([input.malware_family]);

  return [...hints];
}

@Injectable()
export class ReferenceIntelService {
  constructor(
    @InjectModel(ReferenceCve.name)
    private readonly referenceCveModel: Model<ReferenceCve>,
  ) {}

  async interpretThreat(
    input: ThreatInterpretationInput,
  ): Promise<ThreatInterpretationResult> {
    const exactCves = uniqueNormalized(input.cve_mentions);
    const vendorCandidates = uniqueNormalized(input.vendor_candidates);
    const productCandidates = uniqueNormalized(input.product_candidates);
    const technologyTerms = uniqueNormalized(input.technology_terms);
    const threatHintTokens = buildThreatHintTokens(input);

    const candidateDocs = exactCves.length
      ? await this.referenceCveModel
          .find({ cveId: { $in: exactCves.map((value) => value.toUpperCase()) } })
          .lean()
          .exec()
      : await this.findApproximateCandidates({
          vendorCandidates,
          productCandidates,
          technologyTerms,
          threatHintTokens,
          title: input.title,
          text: input.text,
        });

    const matches = candidateDocs
      .map((candidate) => {
        const cveId = candidate.cveId || '';
        const exactMention = exactCves.includes(normalizeText(cveId));
        const candidateVendorTokens = uniqueNormalized(candidate.vendors);
        const candidateProductTokens = uniqueNormalized(candidate.products);
        const candidateTextTokens = tokenize(
          [
            candidate.description,
            ...(candidate.cwes || []),
            ...(candidate.vendors || []),
            ...(candidate.products || []),
          ].join(' '),
        );

        const inputTextTokens = tokenize(
          [
            input.title,
            input.text,
            input.classification_reasoning,
            input.category,
            input.subcategory,
            input.attack_vector,
            input.target_sector,
            input.asset_type,
            input.malware_family,
            input.threat_actor,
            ...input.technology_terms,
            ...input.attack_techniques,
            ...input.vendor_candidates,
            ...input.product_candidates,
            ...threatHintTokens,
          ].join(' '),
        );

        const vendorScore = Math.max(
          overlapScore(vendorCandidates, candidateVendorTokens),
          coverageScore(vendorCandidates, candidateVendorTokens),
        );
        const productScore = Math.max(
          overlapScore(productCandidates, candidateProductTokens),
          coverageScore(productCandidates, candidateProductTokens),
        );
        const semanticScore = Math.max(
          overlapScore(inputTextTokens, candidateTextTokens),
          coverageScore(inputTextTokens, candidateTextTokens),
        );
        const hintScore = coverageScore(threatHintTokens, candidateTextTokens);
        const technologyScore = coverageScore(technologyTerms, candidateTextTokens);
        const severityScore = severityWeight(input.severity);
        const cvssBaseScore = Number(candidate.cvss?.baseScore || 0);
        const cvssSeverityScore =
          cvssBaseScore > 0 ? Math.min(1, cvssBaseScore / 10) : 0.4;

        const score = Math.min(
          1,
          (exactMention ? 0.8 : 0) +
            vendorScore * 0.18 +
            productScore * 0.22 +
            semanticScore * 0.18 +
            hintScore * 0.18 +
            technologyScore * 0.12 +
            cvssSeverityScore * 0.08 +
            severityScore * 0.04,
        );

        const reasons: string[] = [];
        if (exactMention) reasons.push('в статье прямо указан CVE');
        if (vendorScore >= 0.34) reasons.push('есть совпадение по vendor');
        if (productScore >= 0.28) reasons.push('есть совпадение по product');
        if (hintScore >= 0.2) reasons.push('совпадает профиль угрозы');
        if (technologyScore >= 0.2) reasons.push('совпадают техпризнаки');
        if (semanticScore >= 0.16) reasons.push('есть смысловое совпадение описания');
        if (!reasons.length) reasons.push('слабое эвристическое совпадение с эталоном');

        return {
          source: 'NVD' as const,
          reference_id: cveId,
          score: Number(score.toFixed(3)),
          rationale: reasons.slice(0, 3).join('; '),
          base_score: cvssBaseScore || null,
          base_severity: candidate.cvss?.baseSeverity || null,
          vendors: candidate.vendors || [],
          products: candidate.products || [],
          cwes: candidate.cwes || [],
        };
      })
      .filter((item) => item.score >= 0.1)
      .sort((left, right) => right.score - left.score)
      .slice(0, 5);

    const groundingScore = matches.length
      ? Number(matches[0].score.toFixed(3))
      : 0;

    return {
      grounding_score: groundingScore,
      matches,
    };
  }

  private async findApproximateCandidates(input: {
    vendorCandidates: string[];
    productCandidates: string[];
    technologyTerms: string[];
    threatHintTokens: string[];
    title: string;
    text: string;
  }) {
    const rawTokens = uniqueNormalized([
      ...input.vendorCandidates,
      ...input.productCandidates,
      ...input.technologyTerms,
      ...input.threatHintTokens,
      ...tokenize(input.title).slice(0, 8),
      ...tokenize(input.text).slice(0, 16),
    ]).slice(0, 20);

    if (!rawTokens.length) {
      return [];
    }

    const escapedPatterns = rawTokens.map((token) =>
      token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    );
    const regexes = escapedPatterns.map((pattern) => new RegExp(pattern, 'i'));

    return this.referenceCveModel
      .find({
        $or: [
          { vendors: { $in: regexes } },
          { products: { $in: regexes } },
          { description: { $in: regexes } },
          { cwes: { $in: regexes } },
        ],
      })
      .limit(160)
      .lean()
      .exec();
  }
}
