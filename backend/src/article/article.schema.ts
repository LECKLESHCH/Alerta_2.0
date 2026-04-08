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
}

export type ArticleDocument = Article & Document;
export const ArticleSchema = SchemaFactory.createForClass(Article);
