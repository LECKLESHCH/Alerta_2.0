export interface ThreatPrediction {
  riskLevel: 'low' | 'medium' | 'high';
  threatTypes: string[];
  confidence: number; // 0–1
  explanation: string;
}
