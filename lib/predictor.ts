import type { Content } from './cms/blocks';

/**
 * Rank & college predictor (§4.2 row 9). Estimates only: built from the CMS inputs (past-year patterns),
 * shown with a clear "estimate, not a promise" note (the college never promises ranks or seats).
 */
export type PredictorCfg = Content['predictor'];

/** JEE Main: rank ≈ (100 − percentile) / 100 × candidates, as an approximate band. */
export function jeeRank(percentile: number, cfg: Pick<PredictorCfg, 'jeeCandidates'>) {
  if (!Number.isFinite(percentile) || percentile < 0 || percentile > 100) return null;
  const est = Math.max(1, Math.round(((100 - percentile) / 100) * cfg.jeeCandidates));
  return { from: Math.max(1, Math.round(est * 0.9)), to: Math.round(est * 1.1) + 1, estimate: est };
}

/** NEET: the band whose minimum score the student reaches (bands sorted high → low). */
export function neetRank(score: number, cfg: Pick<PredictorCfg, 'neetBands'>) {
  if (!Number.isFinite(score) || score < -180 || score > 720) return null;
  const band = [...cfg.neetBands].sort((a, b) => b.minScore - a.minScore).find((b) => score >= b.minScore);
  return band ? { from: band.rankFrom, to: band.rankTo, estimate: Math.round((band.rankFrom + band.rankTo) / 2) } : null;
}

/** Colleges whose typical closing rank is at or beyond the student's estimated rank. */
export function likelyColleges(exam: 'jee' | 'neet', rank: number, cfg: Pick<PredictorCfg, 'colleges'>) {
  return cfg.colleges.filter((c) => c.exam === exam && rank <= c.maxRank).sort((a, b) => a.maxRank - b.maxRank);
}
