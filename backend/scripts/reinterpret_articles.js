#!/usr/bin/env node
require('reflect-metadata');
require('ts-node/register/transpile-only');

const mongoose = require('mongoose');
const { ReferenceIntelService } = require('../src/reference-intel/reference-intel.service');
const {
  ReferenceCve,
  ReferenceCveSchema,
} = require('../src/reference-intel/reference-cve.schema');

async function main() {
  const mongoUri =
    process.env.MONGO_URI ||
    'mongodb://127.0.0.1:27017/alerta?directConnection=true&serverSelectionTimeoutMS=5000&connectTimeoutMS=5000';

  await mongoose.connect(mongoUri);

  const referenceModel =
    mongoose.models[ReferenceCve.name] ||
    mongoose.model(ReferenceCve.name, ReferenceCveSchema);
  const referenceIntelService = new ReferenceIntelService(referenceModel);
  const articles = mongoose.connection.collection('articles');

  const threatArticles = await articles
    .find({ type: 'threat' })
    .project({
      title: 1,
      text: 1,
      category: 1,
      subcategory: 1,
      severity: 1,
      classification_reasoning: 1,
      attack_vector: 1,
      target_sector: 1,
      cve_mentions: 1,
      vendor_candidates: 1,
      product_candidates: 1,
      technology_terms: 1,
      attack_techniques: 1,
      asset_type: 1,
      threat_actor: 1,
      malware_family: 1,
      interpretation_summary: 1,
      evidence_tokens: 1,
    })
    .toArray();

  let updated = 0;
  let withMatches = 0;
  let novel = 0;

  for (const article of threatArticles) {
    const result = await referenceIntelService.interpretThreat({
      title: article.title || '',
      text: article.text || '',
      category: article.category || null,
      subcategory: article.subcategory || null,
      severity: article.severity || null,
      classification_reasoning: article.classification_reasoning || '',
      attack_vector: article.attack_vector || null,
      target_sector: article.target_sector || null,
      cve_mentions: Array.isArray(article.cve_mentions) ? article.cve_mentions : [],
      vendor_candidates: Array.isArray(article.vendor_candidates)
        ? article.vendor_candidates
        : [],
      product_candidates: Array.isArray(article.product_candidates)
        ? article.product_candidates
        : [],
      technology_terms: Array.isArray(article.technology_terms)
        ? article.technology_terms
        : [],
      attack_techniques: Array.isArray(article.attack_techniques)
        ? article.attack_techniques
        : [],
      asset_type: article.asset_type || null,
      threat_actor: article.threat_actor || null,
      malware_family: article.malware_family || null,
    });

    await articles.updateOne(
      { _id: article._id },
      {
        $set: {
          interpretation_grounding_score: result.grounding_score,
          interpreted_reference_matches: result.matches,
        },
      },
    );

    updated += 1;
    if (result.matches.length > 0) {
      withMatches += 1;
    } else if (
      (article.interpretation_summary && String(article.interpretation_summary).trim()) ||
      (Array.isArray(article.evidence_tokens) && article.evidence_tokens.length)
    ) {
      novel += 1;
    }
  }

  const top = await articles
    .find(
      { type: 'threat' },
      {
        projection: {
          title: 1,
          interpretation_grounding_score: 1,
          interpreted_reference_matches: { $slice: 3 },
        },
      },
    )
    .sort({ interpretation_grounding_score: -1 })
    .limit(10)
    .toArray();

  console.log(
    JSON.stringify(
      {
        updated,
        withMatches,
        novel,
        top,
      },
      null,
      2,
    ),
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
