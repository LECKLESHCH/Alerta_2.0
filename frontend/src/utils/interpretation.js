function normalizeScore(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function getMatches(item) {
  return Array.isArray(item?.interpreted_reference_matches)
    ? item.interpreted_reference_matches
    : [];
}

function hasInterpretationSignals(item) {
  return Boolean(
    (item?.interpretation_summary && String(item.interpretation_summary).trim()) ||
      (Array.isArray(item?.evidence_tokens) && item.evidence_tokens.length) ||
      (Array.isArray(item?.technology_terms) && item.technology_terms.length) ||
      (Array.isArray(item?.vendor_candidates) && item.vendor_candidates.length) ||
      (Array.isArray(item?.product_candidates) && item.product_candidates.length),
  );
}

function hasTechnicalAnchor(item) {
  return Boolean(
    (Array.isArray(item?.cve_mentions) && item.cve_mentions.length) ||
      (Array.isArray(item?.vendor_candidates) && item.vendor_candidates.length) ||
      (Array.isArray(item?.product_candidates) && item.product_candidates.length) ||
      (Array.isArray(item?.technology_terms) && item.technology_terms.length >= 2),
  );
}

export function formatGroundingScore(value) {
  return normalizeScore(value).toFixed(2);
}

export function formatGroundingPercent(value) {
  return `${(normalizeScore(value) * 100).toFixed(1)}%`;
}

export function getInterpretationLevel(item) {
  const score = normalizeScore(item?.interpretation_grounding_score);
  const matches = getMatches(item);
  const anchored = hasTechnicalAnchor(item);

  if (matches.length > 0) {
    if (score >= 0.75) {
      return 'strong';
    }
    if (score >= 0.45) {
      return 'medium';
    }
    if (score >= 0.2) {
      return 'weak';
    }
    if (anchored && score >= 0.12) {
      return 'weak';
    }
    return 'novel';
  }

  if (hasInterpretationSignals(item)) {
    return 'novel';
  }

  return 'none';
}

export function getGroundingLabel(item) {
  switch (getInterpretationLevel(item)) {
    case 'strong':
      return 'Сильная опора';
    case 'medium':
      return 'Средняя опора';
    case 'weak':
      return 'Слабая опора';
    case 'novel':
      return 'Нет опоры';
    default:
      return 'Нет опоры';
  }
}

export function getGroundingBadgeClass(item) {
  switch (getInterpretationLevel(item)) {
    case 'strong':
      return 'badge badge-success';
    case 'medium':
      return 'badge badge-info';
    case 'weak':
      return 'badge badge-warning';
    case 'novel':
      return 'badge badge-secondary text-dark';
    default:
      return 'badge badge-secondary text-dark';
  }
}

export function getPrimaryReference(item) {
  const matches = getMatches(item);
  return matches.length ? matches[0] : null;
}

export function buildInterpretationMeta(item) {
  const groundingScore = normalizeScore(item?.interpretation_grounding_score);
  const level = getInterpretationLevel(item);
  const matches = getMatches(item);
  const primaryReference =
    level === 'novel' || level === 'none' ? null : getPrimaryReference(item);

  return {
    groundingScore,
    groundingPercent: formatGroundingPercent(groundingScore),
    groundingLabel: getGroundingLabel(item),
    groundingBadgeClass: getGroundingBadgeClass(item),
    primaryReference,
    matchCount: matches.length,
    level,
    isNovel: level === 'novel',
  };
}
