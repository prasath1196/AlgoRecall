export interface PatternStat {
  pattern: string;
  problems: number;
  reviews: number;
  avg_quality: number | null;
  retention: number | null;
}

export interface ActiveDay {
  day: string; // YYYY-MM-DD
  count: number;
}

export interface PublicStats {
  current_streak: number;
  longest_streak: number;
  total_reviews: number;
  reviews_last_30d?: number;
  due_today?: number;
  retention_rate: number | null;
  active_days: ActiveDay[];
  patterns: PatternStat[];
  weakest_patterns?: PatternStat[];
}

export interface PublicProfile {
  username: string;
  display_name: string | null;
  member_since: string | null;
  stats: PublicStats;
}
