// Privacy filter — defense in depth. Drops/redacts properties that look like
// PII before they leave the browser. The collector re-runs the same filter
// (privacy.py) so even if a caller forgets, nothing PII-shaped lands in
// analytics_events.

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE_RE = /(\+?\d[\s().-]?){7,}\d/;
const TOKEN_RE = /\b(?:sk|pk|phc|phx|ghp|xox[baprs])[-_][A-Za-z0-9]{16,}\b/;
const ADDRESS_RE = /\b\d{1,6}\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3}\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr)\b/i;

const FORBIDDEN_KEYS = new Set<string>([
  // free text
  'message', 'text', 'body', 'content', 'prompt', 'query', 'q', 'search', 'search_text',
  'note', 'notes', 'caption', 'description', 'bio',
  'cover_letter', 'cover_letter_text',
  'resume', 'resume_text', 'cv', 'cv_text',
  'case_note', 'case_notes', 'case_narrative', 'case_summary',

  // identity / contact
  'email', 'email_address',
  'phone', 'phone_number', 'tel',
  'address', 'street', 'street_address', 'address_line', 'address_line_1', 'address_line_2',
  'name', 'full_name', 'first_name', 'last_name', 'display_name', 'username_text',

  // file content
  'file_name', 'filename', 'original_name', 'attachment_name',

  // payment
  'card', 'card_number', 'cvv', 'cvc', 'iban', 'routing_number', 'account_number',

  // tokens
  'token', 'access_token', 'refresh_token', 'api_key', 'secret', 'password',
]);

const STRING_VALUE_LIMIT = 200;

export interface PrivacyResult<T extends Record<string, unknown>> {
  cleaned: T;
  redacted_keys: string[];
}

/** Strip and redact PII from an event property bag. */
export function scrubProperties<T extends Record<string, unknown>>(props: T): PrivacyResult<T> {
  const redacted: string[] = [];
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    const lower = key.toLowerCase();
    if (FORBIDDEN_KEYS.has(lower)) {
      redacted.push(key);
      continue;
    }
    if (typeof value === 'string') {
      if (value.length > STRING_VALUE_LIMIT) {
        redacted.push(key);
        continue;
      }
      if (EMAIL_RE.test(value) || PHONE_RE.test(value) || TOKEN_RE.test(value) || ADDRESS_RE.test(value)) {
        redacted.push(key);
        continue;
      }
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const sub = scrubProperties(value as Record<string, unknown>);
      cleaned[key] = sub.cleaned;
      for (const r of sub.redacted_keys) redacted.push(`${key}.${r}`);
      continue;
    }
    cleaned[key] = value;
  }
  return { cleaned: cleaned as T, redacted_keys: redacted };
}

export const __test = { EMAIL_RE, PHONE_RE, TOKEN_RE, ADDRESS_RE, FORBIDDEN_KEYS };
