// Live QA sends identical keyed bytes if the transport loses an upload response.
// The API serializes an order and deduplicates each file by its upload key.
import { randomUUID } from 'node:crypto';

export function withQaUploadId(path, body) {
  if (path === '/api/documents' && body instanceof FormData &&
      !body.has('uploadId') && !body.has('uploadKeys')) {
    body.set('uploadId', randomUUID());
  }
  return body;
}

export function hasQaUploadId(body) {
  if (body instanceof FormData) return /^[0-9a-f-]{36}$/i.test(body.get('uploadId') ?? '');
  return Buffer.isBuffer(body) && /name="uploadId"\r\n\r\n[0-9a-f-]{36}\r\n/i.test(body.toString('latin1'));
}

export async function qaDocumentFetch(url, options, { timeout, onTransportRetry = () => {}, fetcher = fetch }) {
  const retry = new URL(url).pathname.endsWith('/api/documents') &&
    options.method === 'POST' && hasQaUploadId(options.body);
  try {
    return await fetcher(url, { ...options, signal: AbortSignal.timeout(timeout) });
  } catch (error) {
    if (!retry) throw error;
    onTransportRetry(error);
    return fetcher(url, { ...options, signal: AbortSignal.timeout(timeout) });
  }
}
