import { describe, it, expect } from 'vitest';
import { parseCurl } from './curlParser';

describe('parseCurl', () => {
  it('parses a simple GET request', () => {
    const result = parseCurl('curl https://api.example.com/users');
    expect(result).not.toBeNull();
    expect(result!.method).toBe('GET');
    expect(result!.url).toBe('https://api.example.com/users');
  });

  it('parses a POST request with header and body', () => {
    const curl = `curl -X POST https://api.example.com/data -H "Content-Type: application/json" -d '{"key":"value"}'`;
    const result = parseCurl(curl);
    expect(result).not.toBeNull();
    expect(result!.method).toBe('POST');
    expect(result!.headers.length).toBe(1);
    expect(result!.headers[0].key).toBe('Content-Type');
    expect(result!.body).toBe('{"key":"value"}');
  });

  it('detects JSON body type from Content-Type header', () => {
    const curl = `curl -X POST https://api.example.com/data -H "Content-Type: application/json" -d '{"key":"value"}'`;
    const result = parseCurl(curl);
    expect(result!.bodyType).toBe('json');
  });

  it('defaults to POST when -d is used', () => {
    const curl = `curl https://api.example.com/data -d "hello"`;
    const result = parseCurl(curl);
    expect(result!.method).toBe('POST');
  });

  it('parses custom method with -X', () => {
    const curl = `curl -X DELETE https://api.example.com/resource/1`;
    const result = parseCurl(curl);
    expect(result!.method).toBe('DELETE');
  });

  it('parses query params from URL', () => {
    const curl = `curl "https://api.example.com/search?q=test&limit=10"`;
    const result = parseCurl(curl);
    expect(result!.params.length).toBe(2);
    expect(result!.params[0].key).toBe('q');
    expect(result!.params[1].key).toBe('limit');
  });

  it('returns null for non-curl commands', () => {
    expect(parseCurl('wget https://example.com')).toBeNull();
    expect(parseCurl('')).toBeNull();
    expect(parseCurl('not curl')).toBeNull();
  });

  it('handles multiple headers', () => {
    const curl = [
      'curl -X PUT https://api.example.com/resource',
      '-H "Authorization: Bearer token123"',
      '-H "Accept: application/json"',
      '-H "X-Custom: value"',
      '-d \'{"name":"test"}\'',
    ].join(' ');
    const result = parseCurl(curl);
    expect(result!.headers.length).toBe(3);
    expect(result!.headers[0].key).toBe('Authorization');
    expect(result!.headers[1].key).toBe('Accept');
    expect(result!.headers[2].key).toBe('X-Custom');
  });
});
