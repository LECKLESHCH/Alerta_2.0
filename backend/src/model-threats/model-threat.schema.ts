import { Schema as MongooseSchema } from 'mongoose';
import { THREAT_CONTROL_SECTIONS } from './threat-controls';

function buildDepthSchemaDefinition() {
  const depth: Record<string, any> = {};
  for (const section of THREAT_CONTROL_SECTIONS) {
    const sectionDefinition: Record<string, any> = {};
    for (const control of section.controls) {
      sectionDefinition[control] = { type: Boolean, default: false };
    }
    if (section.details) {
      for (const detailKey of section.details) {
        sectionDefinition[detailKey] = { type: [String], default: [] };
      }
    }
    depth[section.key] = {
      type: new MongooseSchema(sectionDefinition, { _id: false }),
      default: () => ({}),
    };
  }
  return depth;
}

function createThreatModelSchema(collectionName: string) {
  return new MongooseSchema(
    {
      article_id: { type: String, required: true, index: true },
      article_collection: { type: String, required: true },
      type: { type: String, default: 'threat', index: true },
      url: { type: String, required: true, index: true },
      source: { type: String, default: '' },
      title: { type: String, default: '' },
      text: { type: String, default: '' },
      author: { type: String, default: null },
      publishedAt: { type: Date, default: null },
      category: { type: String, default: null },
      subcategory: { type: String, default: null },
      severity: { type: String, default: null },
      llm_confidence: { type: Number, default: 0 },
      threat_summary: { type: String, default: '' },
      interpretation_summary: { type: String, default: '' },
      interpretation_grounding_score: { type: Number, default: null },
      interpreted_reference_matches: { type: [String], default: [] },
      classification_reasoning: { type: String, default: '' },
      extracted_at: { type: Date, default: null },
      country: { type: String, default: null },
      region: { type: String, default: null },
      target_sector: { type: String, default: null },
      sub_sector: { type: String, default: null },
      asset_type: { type: String, default: null },
      attack_vector: { type: String, default: null },
      attack_scale: { type: String, default: null },
      attack_techniques: { type: [String], default: [] },
      threat_actor: { type: String, default: null },
      malware_family: { type: String, default: null },
      cve_mentions: { type: [String], default: [] },
      exploit_available: { type: Boolean, default: null },
      active_exploitation: { type: Boolean, default: null },
      technology_terms: { type: [String], default: [] },
      vendor_candidates: { type: [String], default: [] },
      product_candidates: { type: [String], default: [] },
      complexity: { type: String, default: null },
      privileges_required: { type: String, default: null },
      user_interaction: { type: String, default: null },
      exposure_required: { type: String, default: null },
      impact_confidentiality: { type: String, default: null },
      impact_integrity: { type: String, default: null },
      impact_availability: { type: String, default: null },
      time_to_exploit: { type: String, default: null },
      evidence_tokens: { type: [String], default: [] },
      targeted_levels: { type: [String], default: [] },
      signal_terms: { type: [String], default: [] },
      reasoning: { type: String, default: '' },
      depth: {
        type: new MongooseSchema(buildDepthSchemaDefinition(), { _id: false }),
        default: () => ({}),
      },
      prompt_version: { type: String, default: 'v2-threat-object-alignment' },
    },
    {
      timestamps: true,
      collection: collectionName,
    },
  );
}

export const ModelThreatWebSchema = createThreatModelSchema('model_threat_web');
export const ModelThreatTgSchema = createThreatModelSchema('model_threat_tg');
export const ModelThreatForumSchema = createThreatModelSchema('model_threat_forum');
