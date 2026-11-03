/** WhatsApp Business Cloud API client (Meta Graph API). Pure payload building + a thin fetch wrapper. */
import type { TemplateDef } from './templates';

export const GRAPH_VERSION = 'v21.0';

export interface CloudConfig {
  phoneNumberId: string;
  accessToken: string;
}

export interface SendInput {
  /** E.164 +91… */
  to: string;
  template: TemplateDef;
  params: string[];
  document?: { link: string; filename: string };
}

/** Cloud API wants the number without '+'. */
export const waNumber = (e164: string) => e164.replace(/^\+/, '');

export function buildTemplatePayload(input: SendInput) {
  const { template, params } = input;
  const components: Record<string, unknown>[] = [];
  if (template.header === 'document') {
    if (!input.document) throw new Error(`${template.name} needs a document`);
    components.push({ type: 'header', parameters: [{ type: 'document', document: input.document }] });
  }
  components.push({ type: 'body', parameters: params.map((text) => ({ type: 'text', text })) });
  if (template.category === 'authentication') {
    // Authentication templates carry the code again in the copy-code (URL) button.
    components.push({ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: params[0] }] });
  }
  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: waNumber(input.to),
    type: 'template',
    template: { name: template.name, language: { code: template.language }, components },
  };
}

/** Free-form text: only allowed inside the 24-hour customer-service window. */
export function buildTextPayload(to: string, body: string) {
  return { messaging_product: 'whatsapp', recipient_type: 'individual', to: waNumber(to), type: 'text', text: { preview_url: false, body } };
}

export class CloudApiError extends Error {
  constructor(
    message: string,
    public code: number | null,
    public retryable: boolean,
  ) {
    super(message);
  }
}

/** Returns the provider message id (wamid…). */
export function sendTemplateMessage(cfg: CloudConfig, input: SendInput, fetchImpl: typeof fetch = fetch): Promise<string> {
  return post(cfg, buildTemplatePayload(input), fetchImpl);
}

export function sendTextMessage(cfg: CloudConfig, to: string, body: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  return post(cfg, buildTextPayload(to, body), fetchImpl);
}

async function post(cfg: CloudConfig, payload: unknown, fetchImpl: typeof fetch): Promise<string> {
  const res = await fetchImpl(`https://graph.facebook.com/${GRAPH_VERSION}/${cfg.phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string; code?: number } };
  if (!res.ok || !data.messages?.[0]?.id) {
    const code = data.error?.code ?? null;
    // 130429 rate limit, 131048 spam rate limit, 5xx: retry later. Others (bad number, template not approved…) are final.
    const retryable = res.status >= 500 || code === 130429 || code === 131048;
    throw new CloudApiError(data.error?.message ?? `HTTP ${res.status}`, code, retryable);
  }
  return data.messages[0].id;
}
