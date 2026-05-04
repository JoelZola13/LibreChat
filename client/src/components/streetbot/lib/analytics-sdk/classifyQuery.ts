// Classify a user search query into a safe category before send.
// Free-text queries are NEVER sent verbatim — the classifier is the gate.
// Static keyword map; no network calls.

import { lengthBucket } from './buckets';

const HEALTH      = /\b(health|medical|clinic|doctor|nurse|hospital|pharmacy|prescription|insurance|covid|vaccine|mental|therap|counsel|addiction|recovery|crisis|suicide|harm)\b/i;
const HOUSING     = /\b(housing|shelter|rent|landlord|eviction|homeless|hud|section.?8|voucher|apartment|sublet|halfway)\b/i;
const FOOD        = /\b(food|pantry|meal|grocery|hunger|wic|snap|ebt|kitchen)\b/i;
const LEGAL       = /\b(legal|lawyer|attorney|court|aid|justice|expungement|dwi|probation|parole|tenant|immigration)\b/i;
const EMPLOYMENT  = /\b(job|employment|career|hire|hiring|resume|cv|interview|workforce|training|apprentice)\b/i;
const FINANCIAL   = /\b(money|financ|loan|debt|tax|credit|bank|grant|stipend|cash)\b/i;
const TRANSPORT   = /\b(bus|transit|ride|transport|metro|subway|train|car|gas|driver)\b/i;
const EDUCATION   = /\b(school|class|tutor|ged|english|esl|math|science|college|university|scholarship|learn|study)\b/i;
const COMMUNITY   = /\b(community|group|club|volunteer|event|meet|neighbor)\b/i;
const CRISIS      = /\b(emergency|crisis|urgent|help.?now|sos|domestic|abuse|violence|trafficking)\b/i;

const GALLERY_MEDIUM = /\b(painting|photo|photograph|sculpture|drawing|digital|video|mixed.?media|print|ceramic|textile)\b/i;
const GALLERY_STYLE  = /\b(abstract|portrait|landscape|street.?art|graffiti|realism|surreal|pop|minimal)\b/i;

const JOB_LOCATION   = /\b(remote|hybrid|onsite|in.?person|near|within|miles?)\b/i;
const JOB_SKILL      = /\b(skill|software|java|python|excel|carpentry|electrician|plumb|driver|cdl|forklift)\b/i;

const ACADEMY_TOPIC  = /\b(course|tutorial|how.?to|guide|certificate|certification)\b/i;

export type QueryCategory =
  | 'directory.service.health'
  | 'directory.service.housing'
  | 'directory.service.food'
  | 'directory.service.legal'
  | 'directory.service.employment'
  | 'directory.service.financial'
  | 'directory.service.transportation'
  | 'directory.service.education'
  | 'directory.service.community'
  | 'directory.service.crisis'
  | 'directory.service.other'
  | 'gallery.medium'
  | 'gallery.style'
  | 'gallery.tag'
  | 'jobs.title'
  | 'jobs.skill'
  | 'jobs.location'
  | 'academy.topic'
  | 'documents.title'
  | 'unclassified';

export interface QueryClassification {
  query_category:        QueryCategory;
  query_length_bucket:   '1-3' | '4-10' | '11-30' | '31+';
  has_quotes:            boolean;
  has_filter_syntax:     boolean;
}

export interface ClassifyOptions {
  /** Hint the surface we're searching from — narrows the category space. */
  surface?: 'directory' | 'gallery' | 'jobs' | 'academy' | 'documents' | 'profile' | 'unknown';
}

export function classifyQuery(raw: string, opts: ClassifyOptions = {}): QueryClassification {
  const trimmed = (raw ?? '').trim();
  const len = trimmed.length;

  const has_quotes = /["']/.test(trimmed);
  const has_filter_syntax = /[:=#@]/.test(trimmed);
  const query_length_bucket: QueryClassification['query_length_bucket'] =
    len <= 3 ? '1-3' : len <= 10 ? '4-10' : len <= 30 ? '11-30' : '31+';

  const surface = opts.surface ?? 'unknown';

  if (surface === 'directory' || surface === 'unknown') {
    if (CRISIS.test(trimmed))     return base('directory.service.crisis');
    if (HEALTH.test(trimmed))     return base('directory.service.health');
    if (HOUSING.test(trimmed))    return base('directory.service.housing');
    if (FOOD.test(trimmed))       return base('directory.service.food');
    if (LEGAL.test(trimmed))      return base('directory.service.legal');
    if (EMPLOYMENT.test(trimmed)) return base('directory.service.employment');
    if (FINANCIAL.test(trimmed))  return base('directory.service.financial');
    if (TRANSPORT.test(trimmed))  return base('directory.service.transportation');
    if (EDUCATION.test(trimmed))  return base('directory.service.education');
    if (COMMUNITY.test(trimmed))  return base('directory.service.community');
    if (surface === 'directory')  return base('directory.service.other');
  }
  if (surface === 'gallery') {
    if (GALLERY_MEDIUM.test(trimmed)) return base('gallery.medium');
    if (GALLERY_STYLE.test(trimmed))  return base('gallery.style');
    return base('gallery.tag');
  }
  if (surface === 'jobs') {
    if (JOB_LOCATION.test(trimmed)) return base('jobs.location');
    if (JOB_SKILL.test(trimmed))    return base('jobs.skill');
    return base('jobs.title');
  }
  if (surface === 'academy') {
    if (ACADEMY_TOPIC.test(trimmed)) return base('academy.topic');
    return base('academy.topic');
  }
  if (surface === 'documents') return base('documents.title');

  return base('unclassified');

  function base(query_category: QueryCategory): QueryClassification {
    return { query_category, query_length_bucket, has_quotes, has_filter_syntax };
  }
}

export { lengthBucket };
