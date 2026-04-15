function safeNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function average(values) {
  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, value) => sum + safeNumber(value), 0) / values.length;
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function includesAny(haystack, needles) {
  return needles.some((needle) => haystack.includes(needle));
}

function scoreBoolean(value) {
  return value ? 1 : 0;
}

function severityScore(severity) {
  switch (normalizeText(severity)) {
    case 'critical':
      return 1;
    case 'high':
      return 0.85;
    case 'medium':
      return 0.6;
    case 'low':
      return 0.35;
    default:
      return 0.2;
  }
}

function maturityScore(level) {
  switch (normalizeText(level)) {
    case 'высокая':
      return 0.85;
    case 'средняя':
      return 0.55;
    case 'низкая':
      return 0.25;
    default:
      return 0.5;
  }
}

function getObjectSectorTags(objectItem) {
  const values = [
    objectItem.industry,
    objectItem.subIndustry,
    objectItem.objectType,
    objectItem.comments,
  ]
    .filter(Boolean)
    .map(normalizeText)
    .join(' ');

  const tags = new Set();

  if (includesAny(values, ['энерг', 'подстанц', 'генерац', 'электро'])) {
    tags.add('energy');
  }
  if (includesAny(values, ['транспорт', 'логист', 'порт', 'вокзал'])) {
    tags.add('transport');
  }
  if (includesAny(values, ['финанс', 'банк', 'платеж'])) {
    tags.add('finance');
  }
  if (includesAny(values, ['госсектор', 'гос', 'реестр', 'ведом'])) {
    tags.add('gov');
  }
  if (includesAny(values, ['телеком', 'связ', 'оператор'])) {
    tags.add('telecom');
  }
  if (includesAny(values, ['промышлен', 'завод', 'производ'])) {
    tags.add('industry');
  }
  if (objectItem.isIcs) {
    tags.add('ics');
  }

  return tags;
}

function getThreatSectorTags(threatItem) {
  const values = [
    threatItem.target_sector,
    threatItem.category,
    threatItem.subcategory,
    threatItem.title,
    threatItem.classification_reasoning,
  ]
    .filter(Boolean)
    .map(normalizeText)
    .join(' ');

  const tags = new Set();

  if (includesAny(values, ['energy', 'энерг'])) {
    tags.add('energy');
  }
  if (includesAny(values, ['transport', 'транспорт'])) {
    tags.add('transport');
  }
  if (includesAny(values, ['finance', 'финанс', 'bank', 'банк'])) {
    tags.add('finance');
  }
  if (includesAny(values, ['gov', 'government', 'гос', 'ведом'])) {
    tags.add('gov');
  }
  if (includesAny(values, ['telecom', 'связ', 'оператор'])) {
    tags.add('telecom');
  }
  if (includesAny(values, ['industrial', 'ics', 'scada', 'промыш', 'асу'])) {
    tags.add('industry');
    tags.add('ics');
  }

  return tags;
}

function normalizeRegion(value) {
  const normalized = normalizeText(value);

  if (!normalized) {
    return '';
  }

  if (includesAny(normalized, ['global', 'мир', 'world', 'весь мир'])) {
    return 'global';
  }

  if (includesAny(normalized, ['россия', 'russia', 'рф'])) {
    return 'russia';
  }

  if (includesAny(normalized, ['сша', 'usa', 'united states', 'us '])) {
    return 'usa';
  }

  return normalized;
}

function getThreatFamily(category) {
  const normalized = normalizeText(category);

  if (
    includesAny(normalized, ['фиш', 'phishing', 'мошен', 'fraud'])
  ) {
    return 'social';
  }

  if (
    includesAny(normalized, ['supply chain', 'цепочк'])
  ) {
    return 'supply_chain';
  }

  if (
    includesAny(normalized, ['cloud', 'облач'])
  ) {
    return 'cloud';
  }

  if (
    includesAny(normalized, ['physical-cyber', 'ics', 'асу', 'киберфиз', 'промыш'])
  ) {
    return 'ics';
  }

  if (
    includesAny(normalized, ['vulnerabilities', 'exploit', 'уязв', 'эксплуатац'])
  ) {
    return 'exploit';
  }

  if (
    includesAny(normalized, ['network', 'ddos', 'сетев'])
  ) {
    return 'network';
  }

  if (
    includesAny(normalized, ['data breach', 'утеч', 'credential'])
  ) {
    return 'data_breach';
  }

  if (
    includesAny(normalized, ['apt'])
  ) {
    return 'apt';
  }

  if (
    includesAny(normalized, ['malware', 'вредонос'])
  ) {
    return 'malware';
  }

  return 'generic';
}

function buildThreatIntensity(threatItem) {
  const severity = severityScore(threatItem.severity);
  const exploitScore = clamp(
    0.6 * scoreBoolean(threatItem.active_exploitation) +
      0.4 * safeNumber(threatItem.exploit_available, 0.35),
  );
  const confidence = safeNumber(threatItem.llm_confidence, 0.55);
  const ciaImpact = average([
    threatItem.impact_confidentiality,
    threatItem.impact_integrity,
    threatItem.impact_availability,
  ]);

  return clamp(
    0.35 * severity +
      0.25 * exploitScore +
      0.15 * confidence +
      0.25 * (ciaImpact || severity),
  );
}

function buildObjectCriticality(objectItem) {
  return clamp(0.6 + 0.4 * safeNumber(objectItem.businessCriticality, 0.5));
}

function buildSectorMatch(threatItem, objectItem) {
  const threatTags = getThreatSectorTags(threatItem);
  const objectTags = getObjectSectorTags(objectItem);

  if (!threatTags.size) {
    return 0.3;
  }

  const overlap = Array.from(threatTags).filter((tag) => objectTags.has(tag)).length;

  if (overlap > 0) {
    return clamp(0.7 + overlap * 0.15);
  }

  if (
    threatTags.has('industry') ||
    threatTags.has('ics') ||
    threatTags.has('energy') ||
    threatTags.has('transport')
  ) {
    return 0.1;
  }

  return 0.3;
}

function buildRegionMatch(threatItem, objectItem) {
  const threatRegion = normalizeRegion(threatItem.region || threatItem.country);
  const objectRegion = normalizeRegion(objectItem.region);

  if (!threatRegion || !objectRegion) {
    return 0.5;
  }

  if (threatRegion === 'global') {
    return 0.5;
  }

  if (threatRegion === objectRegion) {
    return 1;
  }

  if (
    (threatRegion === 'russia' && includesAny(objectRegion, ['моск', 'санкт', 'росс'])) ||
    (objectRegion === 'russia' && includesAny(threatRegion, ['моск', 'санкт', 'росс']))
  ) {
    return 0.8;
  }

  return 0.2;
}

function buildTypeMatch(threatItem, objectItem) {
  const family = getThreatFamily(threatItem.category);
  const objectType = normalizeText(objectItem.objectType);

  if (family === 'ics') {
    return objectItem.isIcs || objectType.includes('асу') ? 1 : 0.1;
  }

  if (family === 'cloud') {
    return clamp(0.2 + 0.8 * safeNumber(objectItem.cloudPresence, 0));
  }

  if (family === 'social') {
    return clamp(0.2 + 0.8 * safeNumber(objectItem.userInteractionDependency, 0));
  }

  if (family === 'network') {
    return clamp(
      average([
        scoreBoolean(objectItem.internetExposed),
        safeNumber(objectItem.remoteAccessLevel, 0),
      ]),
    );
  }

  return 0.6;
}

function buildVectorFit(threatItem, objectItem) {
  const attackVector = normalizeText(threatItem.attack_vector);

  if (attackVector === 'network') {
    return clamp(
      average([
        objectItem.attackSurface,
        objectItem.remoteAccessLevel,
        scoreBoolean(objectItem.internetExposed),
      ]),
    );
  }

  if (attackVector === 'physical') {
    return clamp(
      average([
        scoreBoolean(objectItem.isIcs),
        objectItem.impactAvailability,
        1 - safeNumber(objectItem.segmentationLevel, 0.5),
      ]),
    );
  }

  if (attackVector === 'local' || attackVector === 'adjacent') {
    return clamp(
      average([
        scoreBoolean(objectItem.contractorAccess),
        objectItem.remoteAccessLevel,
        objectItem.legacyShare,
      ]),
    );
  }

  return 0.55;
}

function buildRelevanceScore(threatItem, objectItem) {
  const sectorMatch = buildSectorMatch(threatItem, objectItem);
  const regionMatch = buildRegionMatch(threatItem, objectItem);
  const vectorMatch = buildVectorFit(threatItem, objectItem);
  const typeMatch = buildTypeMatch(threatItem, objectItem);

  return {
    score: clamp(
      0.4 * sectorMatch +
        0.2 * regionMatch +
        0.25 * vectorMatch +
        0.15 * typeMatch,
    ),
    sectorMatch,
    regionMatch,
    vectorMatch,
    typeMatch,
  };
}

function buildExposureScore(threatItem, objectItem) {
  const userFactorAdjusted = threatItem.user_interaction
    ? safeNumber(objectItem.userInteractionDependency, 0)
    : 0.5;
  const thirdPartyExposure = scoreBoolean(objectItem.contractorAccess);

  return clamp(
    0.25 * scoreBoolean(objectItem.internetExposed) +
      0.2 * thirdPartyExposure +
      0.2 * safeNumber(objectItem.remoteAccessLevel, 0) +
      0.25 * safeNumber(objectItem.attackSurface, 0) +
      0.1 * userFactorAdjusted,
  );
}

function buildWeaknessScore(threatItem, objectItem) {
  const family = getThreatFamily(threatItem.category);
  const securityWeakness = 1 - maturityScore(objectItem.securityMaturity);
  const monitoringWeakness = 1 - maturityScore(objectItem.monitoringMaturity);
  const patchWeakness = 1 - maturityScore(objectItem.patchMaturity);
  const segmentationWeakness = 1 - safeNumber(objectItem.segmentationLevel, 0.5);

  if (family === 'exploit') {
    return clamp(
      0.2 * securityWeakness +
        0.2 * monitoringWeakness +
        0.4 * patchWeakness +
        0.2 * segmentationWeakness,
    );
  }

  if (family === 'network' || family === 'ics') {
    return clamp(
      0.2 * securityWeakness +
        0.3 * monitoringWeakness +
        0.1 * patchWeakness +
        0.4 * segmentationWeakness,
    );
  }

  if (family === 'malware') {
    return clamp(
      0.25 * securityWeakness +
        0.45 * monitoringWeakness +
        0.2 * patchWeakness +
        0.1 * segmentationWeakness,
    );
  }

  return clamp(
    0.3 * securityWeakness +
      0.25 * monitoringWeakness +
      0.25 * patchWeakness +
      0.2 * segmentationWeakness,
  );
}

function buildReasons(threatItem, objectItem, components) {
  const reasons = [];

  if (components.relevanceScore >= 0.72) {
    reasons.push('профиль угрозы совпадает с отраслью объекта');
  }
  if (components.vectorMatch >= 0.75 || components.typeMatch >= 0.75) {
    reasons.push('тип и вектор атаки хорошо соответствуют профилю объекта');
  }
  if (components.exposureScore >= 0.65) {
    reasons.push('объект имеет повышенную поверхность атаки');
  }
  if (components.weaknessScore >= 0.6) {
    reasons.push('уровень зрелости защиты усиливает итоговый риск');
  }
  if (components.threatIntensity >= 0.72) {
    reasons.push('сама угроза выглядит интенсивной по severity и метрикам эксплуатации');
  }

  return reasons.slice(0, 3);
}

export function getRiskLevel(score) {
  if (score >= 0.75) {
    return 'high';
  }
  if (score >= 0.5) {
    return 'medium';
  }
  if (score >= 0.3) {
    return 'low';
  }
  return 'n/a';
}

export function getRiskLabel(level) {
  switch (level) {
    case 'high':
      return 'Высокий';
    case 'medium':
      return 'Средний';
    case 'low':
      return 'Низкий';
    default:
      return 'Фоновый';
  }
}

export function getRiskProgressVariant(level) {
  switch (level) {
    case 'high':
      return 'danger';
    case 'medium':
      return 'warning';
    case 'low':
      return 'success';
    default:
      return 'info';
  }
}

export function getRiskBadgeClass(level) {
  switch (level) {
    case 'high':
      return 'badge badge-danger';
    case 'medium':
      return 'badge badge-warning';
    case 'low':
      return 'badge badge-success';
    default:
      return 'badge badge-info';
  }
}

export function formatRiskPercent(score) {
  return `${(clamp(score) * 100).toFixed(1)}%`;
}

export function formatThreatDate(value) {
  if (!value) {
    return 'Без даты';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Без даты';
  }

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function buildObjectThreatMatches(objectItem, threatItems) {
  if (!objectItem) {
    return [];
  }

  return threatItems
    .map((threatItem) => {
      const threatIntensity = buildThreatIntensity(threatItem);
      const objectCriticality = buildObjectCriticality(objectItem);
      const {
        score: relevanceScore,
        sectorMatch,
        regionMatch,
        vectorMatch,
        typeMatch,
      } = buildRelevanceScore(threatItem, objectItem);
      const exposureScore = buildExposureScore(threatItem, objectItem);
      const weaknessScore = buildWeaknessScore(threatItem, objectItem);

      const score = clamp(
        threatIntensity *
          average([relevanceScore, exposureScore, weaknessScore]) *
          objectCriticality,
      );

      const level = getRiskLevel(score);

      return {
        threat: threatItem,
        score,
        level,
        relevanceScore,
        exposureScore,
        weaknessScore,
        threatIntensity,
        objectCriticality,
        reasons: buildReasons(threatItem, objectItem, {
          relevanceScore,
          sectorMatch,
          regionMatch,
          vectorMatch,
          typeMatch,
          exposureScore,
          weaknessScore,
          threatIntensity,
        }),
      };
    })
    .sort((left, right) => right.score - left.score);
}

export function summarizeObjectRisk(matches) {
  const highCount = matches.filter((item) => item.level === 'high').length;
  const mediumCount = matches.filter((item) => item.level === 'medium').length;
  const lowCount = matches.filter((item) => item.level === 'low').length;
  const averageScore = matches.length
    ? matches.reduce((sum, item) => sum + item.score, 0) / matches.length
    : 0;

  return {
    highCount,
    mediumCount,
    lowCount,
    averageScore,
  };
}
