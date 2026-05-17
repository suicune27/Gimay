import { BodyType, HttpMethod, KeyValue } from '../types';

export interface ParsedCurl {
  method: HttpMethod;
  url: string;
  headers: KeyValue[];
  params: KeyValue[];
  body: string;
  bodyType: BodyType;
}

export function parseCurl(curlCommand: string): ParsedCurl | null {
  const trimmed = curlCommand.trim();
  if (!trimmed.toLowerCase().startsWith('curl ')) {
    return null;
  }

  // A basic tokenizer for shell-like strings
  const tokens: string[] = [];
  let currentToken = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let escapeNext = false;

  for (let i = 4; i < trimmed.length; i++) {
    const char = trimmed[i];

    if (escapeNext) {
      currentToken += char;
      escapeNext = false;
      continue;
    }

    if (char === '\\' && !inSingleQuote) {
      escapeNext = true;
      continue;
    }

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      continue;
    }

    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    if (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
      if (inSingleQuote || inDoubleQuote) {
        currentToken += char;
      } else if (currentToken.length > 0) {
        tokens.push(currentToken);
        currentToken = '';
      }
      continue;
    }

    currentToken += char;
  }

  if (currentToken.length > 0) {
    tokens.push(currentToken);
  }

  let method: HttpMethod = 'GET';
  let url = '';
  const headers: KeyValue[] = [];
  let body = '';
  let bodyType: BodyType = 'none';

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (token === '-X' || token === '--request') {
      const nextToken = tokens[i + 1]?.toUpperCase();
      if (['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'].includes(nextToken)) {
        method = nextToken as HttpMethod;
      }
      i++;
    } else if (token === '-H' || token === '--header') {
      const headerLine = tokens[i + 1];
      if (headerLine) {
        const colonIdx = headerLine.indexOf(':');
        if (colonIdx > 0) {
          const key = headerLine.substring(0, colonIdx).trim();
          const value = headerLine.substring(colonIdx + 1).trim();
          headers.push({ id: Math.random().toString(36).substring(2), key, value, active: true });
        }
      }
      i++;
    } else if (token === '-d' || token === '--data' || token === '--data-raw' || token === '--data-binary') {
      if (method === 'GET') method = 'POST'; // curl defaults to POST if -d is used
      body = tokens[i + 1] || '';
      bodyType = 'raw';
      i++;
    } else if (token.startsWith('http://') || token.startsWith('https://')) {
      url = token;
    } else if (!token.startsWith('-') && !url) {
      // Sometimes URL doesn't have http schema (though curl requires it, people paste it)
      // or we just assume the first non-flag arg is URL
      url = token;
    }
  }

  // Attempt to guess body type from Content-Type header if present
  const contentTypeHeader = headers.find(h => h.key.toLowerCase() === 'content-type');
  if (contentTypeHeader && bodyType === 'raw') {
    const ct = (contentTypeHeader.value || '').toLowerCase();
    if (ct.includes('application/json')) bodyType = 'json';
    else if (ct.includes('application/x-www-form-urlencoded')) bodyType = 'urlencoded';
    else if (ct.includes('multipart/form-data')) bodyType = 'form-data';
    else if (ct.includes('graphql')) bodyType = 'graphql';
  }

  // Parse query params from URL
  const params: KeyValue[] = [];
  if (url) {
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
      urlObj.searchParams.forEach((value, key) => {
        params.push({ id: Math.random().toString(36).substring(2), key, value, active: true });
      });
      // Optionally strip query string from URL base?
      // For Postman, the URL usually retains the base + query in the url field
    } catch {
      // Ignore URL parsing errors
    }
  }

  if (!url) return null;

  return {
    method,
    url,
    headers,
    params,
    body,
    bodyType
  };
}
