#!/usr/bin/env node

const axios = require('axios');
const mongoose = require('mongoose');
const zlib = require('zlib');

const FEED_BASE = 'https://nvd.nist.gov/feeds/json/cve/2.0';
const MONGO_URI =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  'mongodb://127.0.0.1:27017/alerta';

const args = process.argv.slice(2);
const explicitYears = args.filter((item) => /^\d{4}$/.test(item));
const currentYear = new Date().getUTCFullYear();
const years =
  explicitYears.length > 0
    ? explicitYears
    : [String(currentYear - 2), String(currentYear - 1), String(currentYear)];

function pickEnglishDescription(descriptions) {
  const english = (descriptions || []).find((item) => item.lang === 'en');
  return (english && english.value) || (descriptions && descriptions[0] && descriptions[0].value) || '';
}

function extractWeaknesses(weaknesses) {
  return Array.from(
    new Set(
      (weaknesses || [])
        .flatMap((item) => item.description || [])
        .map((item) => item.value)
        .filter(Boolean),
    ),
  );
}

function parseCpe(cpe) {
  const parts = String(cpe || '').split(':');
  if (parts.length < 6) {
    return { vendor: '', product: '' };
  }
  return {
    vendor: parts[3] || '',
    product: parts[4] || '',
  };
}

function extractConfigurations(configurations) {
  const cpes = [];
  const vendors = new Set();
  const products = new Set();

  const walk = (nodes) => {
    (nodes || []).forEach((node) => {
      (node.cpeMatch || []).forEach((match) => {
        if (!match.criteria) return;
        cpes.push(match.criteria);
        const parsed = parseCpe(match.criteria);
        if (parsed.vendor) vendors.add(parsed.vendor);
        if (parsed.product) products.add(parsed.product);
      });
      walk(node.children || []);
    });
  };

  walk((configurations || []).flatMap((item) => item.nodes || []));

  return {
    cpes: Array.from(new Set(cpes)),
    vendors: Array.from(vendors),
    products: Array.from(products),
  };
}

function pickCvss(metrics) {
  const v31 = metrics && metrics.cvssMetricV31 && metrics.cvssMetricV31[0];
  const v30 = metrics && metrics.cvssMetricV30 && metrics.cvssMetricV30[0];
  const v2 = metrics && metrics.cvssMetricV2 && metrics.cvssMetricV2[0];
  const candidate = v31 || v30 || v2;
  if (!candidate) return null;

  const data = candidate.cvssData || {};
  return {
    version: String(data.version || ''),
    baseScore: Number(data.baseScore || 0),
    baseSeverity: String(
      data.baseSeverity || candidate.baseSeverity || candidate.severity || '',
    ),
    vectorString: String(data.vectorString || ''),
    attackVector: String(data.attackVector || ''),
    attackComplexity: String(data.attackComplexity || ''),
    privilegesRequired: String(data.privilegesRequired || ''),
    userInteraction: String(data.userInteraction || ''),
  };
}

function mapVulnerability(item) {
  const cve = item.cve || {};
  const configs = extractConfigurations(cve.configurations);

  return {
    updateOne: {
      filter: { cveId: cve.id },
      update: {
        $set: {
          cveId: cve.id,
          sourceIdentifier: cve.sourceIdentifier || '',
          vulnStatus: cve.vulnStatus || '',
          publishedAt: cve.published ? new Date(cve.published) : null,
          lastModifiedAt: cve.lastModified ? new Date(cve.lastModified) : null,
          description: pickEnglishDescription(cve.descriptions),
          cwes: extractWeaknesses(cve.weaknesses),
          cpes: configs.cpes,
          vendors: configs.vendors,
          products: configs.products,
          references: Array.from(
            new Set((cve.references || []).map((ref) => ref.url).filter(Boolean)),
          ),
          cvss: pickCvss(cve.metrics),
          hasKev: Boolean(cve.cisaExploitAdd),
        },
      },
      upsert: true,
    },
  };
}

async function downloadFeed(feedName) {
  const url = `${FEED_BASE}/${feedName}`;
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 120000,
  });
  const json = zlib.gunzipSync(Buffer.from(response.data)).toString('utf8');
  return JSON.parse(json);
}

async function main() {
  await mongoose.connect(MONGO_URI);
  const collection = mongoose.connection.collection('reference_cves');
  await collection.createIndex({ cveId: 1 }, { unique: true });
  await collection.createIndex({ vendors: 1 });
  await collection.createIndex({ products: 1 });

  let totalProcessed = 0;

  for (const year of years) {
    const feedName = `nvdcve-2.0-${year}.json.gz`;
    process.stdout.write(`Importing ${feedName}...\n`);
    const payload = await downloadFeed(feedName);
    const vulnerabilities = Array.isArray(payload.vulnerabilities)
      ? payload.vulnerabilities
      : [];
    const operations = vulnerabilities.map(mapVulnerability);

    for (let i = 0; i < operations.length; i += 500) {
      const batch = operations.slice(i, i + 500);
      if (batch.length) {
        await collection.bulkWrite(batch, { ordered: false });
      }
    }

    totalProcessed += operations.length;
    process.stdout.write(
      `Imported ${operations.length} CVE records from ${year}\n`,
    );
  }

  process.stdout.write(
    `${JSON.stringify({ years, totalProcessed }, null, 2)}\n`,
  );
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
