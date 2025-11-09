export type PlaceKind = 'village' | 'gp' | 'ward' | 'ulb' | 'block' | 'tehsil' | 'district' | 'unknown';

export interface LocationResolveInput {
  raw_text: string;
  detected_place: string;
  place_kind_hint?: PlaceKind;
  context?: {
    tweet_id?: string;
    timestamp?: string;
    language?: string;
  };
}

export interface HierarchyNode {
  id: string;
  name: string;
}

export interface GazetteerEntry {
  id: string;
  name: string;
  kind: PlaceKind;
  block?: HierarchyNode;
  district?: HierarchyNode;
  state?: HierarchyNode;
  country?: HierarchyNode;
  parent?: HierarchyNode;
  ulb_or_gp?: {
    type: 'ULB' | 'GP' | 'WARD';
    name: string;
  };
  path: string[];
  codes?: Record<string, string>;
}

export interface PlaceCandidate {
  name: string;
  kind: PlaceKind;
  score: number;
  source: 'faiss' | 'milvus';
  entry?: GazetteerEntry;
  pathComplete: boolean;
  reason?: string;
}

export interface ResolutionAudit {
  tweet_id?: string;
  candidates_considered: number;
  indices_hit: string[];
  latency_ms: number;
}

export interface FinalChoice {
  id: string;
  name: string;
  kind: PlaceKind;
  block?: HierarchyNode;
  district?: HierarchyNode;
  state?: HierarchyNode;
  country?: HierarchyNode;
  ulb_or_gp?: GazetteerEntry['ulb_or_gp'];
  full_path: string[];
  codes?: Record<string, string>;
  confidence: number;
  decided_by: 'auto' | 'human';
  decided_at: string;
  version: number;
}

export interface LocationResolutionResult {
  status: 'auto_accepted' | 'needs_review';
  normalized_query: string;
  place_key: string;
  best_candidate?: PlaceCandidate;
  candidates: PlaceCandidate[];
  persisted_choice?: FinalChoice;
  audit: ResolutionAudit;
}
