import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Article {
  @Prop({ required: true, unique: true })
  url: string;

  @Prop({ required: true })
  source: string;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true, type: String })
  text: string;

  @Prop({ required: true })
  publishedAt: Date;

  @Prop({ required: false })
  author: string;

  @Prop({ required: false })
  type: string; // 'news' | 'threat'

  @Prop({ required: false })
  category: string;

  @Prop({ required: false })
  subcategory: string;

  @Prop({ required: false })
  severity: string; // 'high' | 'medium' | 'low' | null

  @Prop({ required: false })
  country: string; // 'Russia', 'USA', 'Global', etc.

  @Prop({ required: false })
  vulnerability_type: string; // '0-day' | 'n-day' | null

  @Prop({ required: false })
  classification_reasoning: string;

  @Prop({ required: false })
  target_sector: string; // energy|finance|gov|generic

  @Prop({ required: false })
  sub_sector: string;

  @Prop({ required: false })
  attack_scale: number; // 0..1

  @Prop({ required: false })
  region: string; // country name

  @Prop({ required: false })
  attack_vector: string; // network|local|adjacent|physical

  @Prop({ required: false })
  exposure_required: boolean;

  @Prop({ required: false })
  user_interaction: boolean;

  @Prop({ required: false })
  complexity: number; // 0..1

  @Prop({ required: false })
  exploit_available: number; // 0..1

  @Prop({ required: false })
  privileges_required: number; // 0..1

  @Prop({ required: false })
  impact_confidentiality: number; // 0..1

  @Prop({ required: false })
  impact_integrity: number; // 0..1

  @Prop({ required: false })
  impact_availability: number; // 0..1

  @Prop({ required: false })
  active_exploitation: boolean;

  @Prop({ required: false })
  time_to_exploit: number; // 0..1

  @Prop({ required: false })
  llm_confidence: number; // 0..1

  @Prop({ required: false })
  extracted_at: Date;

  @Prop({ required: false, type: [String], default: [] })
  cve_mentions: string[];

  @Prop({ required: false, type: [String], default: [] })
  vendor_candidates: string[];

  @Prop({ required: false, type: [String], default: [] })
  product_candidates: string[];

  @Prop({ required: false, type: [String], default: [] })
  technology_terms: string[];

  @Prop({ required: false, type: [String], default: [] })
  attack_techniques: string[];

  @Prop({ required: false })
  asset_type: string;

  @Prop({ required: false })
  threat_actor: string;

  @Prop({ required: false })
  malware_family: string;

  @Prop({ required: false, type: [String], default: [] })
  evidence_tokens: string[];

  @Prop({ required: false })
  interpretation_summary: string;

  @Prop({ required: false, default: 0 })
  interpretation_grounding_score: number;

  @Prop({
    required: false,
    type: [
      {
        source: { type: String, default: 'NVD' },
        reference_id: { type: String, default: '' },
        score: { type: Number, default: 0 },
        rationale: { type: String, default: '' },
        base_score: { type: Number, default: null },
        base_severity: { type: String, default: null },
        vendors: { type: [String], default: [] },
        products: { type: [String], default: [] },
        cwes: { type: [String], default: [] },
      },
    ],
    default: [],
  })
  interpreted_reference_matches: Array<{
    source: string;
    reference_id: string;
    score: number;
    rationale: string;
    base_score: number | null;
    base_severity: string | null;
    vendors: string[];
    products: string[];
    cwes: string[];
  }>;
}

export type ArticleDocument = Article & Document;
export const ArticleSchema = SchemaFactory.createForClass(Article);
