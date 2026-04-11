export interface BackendConfig {
  name: string;
  label: string;
  costPerPageEstimate: number;
  kreuzbergConfig: Record<string, unknown>;
}

export interface CachedExtraction {
  file_hash: string;
  backend: string;
  fixture_name: string;
  extracted_text: string;
  extraction_time_ms: number;
  page_count: number | null;
  token_usage?: {
    input?: number;
    output?: number;
  };
  timestamp: string;
}

export interface JudgeScore {
  completeness: number;
  accuracy: number;
  structure: number;
  overall: number;
  notes: string;
}

export interface FixtureInfo {
  filePath: string;
  fileName: string;
  difficulty: "Easy" | "Medium" | "Hard";
}

export interface EvaluatedFixtureResult {
  fixture: FixtureInfo;
  backend: BackendConfig;
  extraction: CachedExtraction;
  score: JudgeScore;
}

export interface EvaluationReportData {
  generatedAt: string;
  results: EvaluatedFixtureResult[];
}
