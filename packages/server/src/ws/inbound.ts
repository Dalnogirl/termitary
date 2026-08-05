import { type ClientMessage, ClientMessageSchema } from '@hive/protocol';

export type InboundParse =
  | { readonly ok: true; readonly message: ClientMessage }
  | { readonly ok: false; readonly error: string };

export const parseInbound = (raw: Buffer | string): InboundParse => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.toString());
  } catch {
    return { ok: false, error: 'invalid JSON' };
  }
  const result = ClientMessageSchema.safeParse(parsed);
  if (!result.success) return { ok: false, error: 'invalid message' };
  return { ok: true, message: result.data };
};
