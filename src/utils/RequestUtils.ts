import { RequestData, RequestBody, BodyType, KeyValue, FormDataItem } from '../types';

export class RequestUtils {
  private static generateId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
  static normalizeRequestBody(body: string | RequestBody | undefined, type: BodyType): RequestBody {
    const defaultBody: RequestBody = {
      type: type || 'none',
      content: '',
      formData: [],
      urlencoded: [],
      graphql: {
        query: '',
        variables: ''
      }
    };

    if (!body) return defaultBody;

    // If it's already a RequestBody object, merge with defaults to ensure all fields exist
    if (typeof body === 'object' && 'type' in body) {
      return {
        ...defaultBody,
        ...body,
        graphql: {
          ...defaultBody.graphql,
          ...body.graphql
        }
      };
    }

    // If it's a string, try to parse it or just put it in content
    const bodyStr = typeof body === 'string' ? body : '';
    
    const normalized = { ...defaultBody, type };

    if (type === 'json' || type === 'raw' || type === 'xml') {
      normalized.content = bodyStr;
    } else if (type === 'graphql') {
      try {
        const parsed = JSON.parse(bodyStr);
        normalized.graphql = {
          query: parsed.query || '',
          variables: typeof parsed.variables === 'string' ? parsed.variables : JSON.stringify(parsed.variables || {}, null, 2)
        };
      } catch {
        normalized.graphql.query = bodyStr;
      }
    } else if (type === 'form-data') {
      // Very basic attempt to parse if it was stored as string
      normalized.formData = [];
    } else if (type === 'urlencoded') {
      normalized.urlencoded = [];
    }

    return normalized;
  }

  static normalizeRequest(request: Partial<RequestData>): RequestData {
    const bodyType = request.bodyType || 'none';
    const normalizedBody = this.normalizeRequestBody(request.body as any, bodyType);

    return {
      id: request.id || this.generateId(),
      collection_id: request.collection_id,
      folder_id: request.folder_id,
      workspace_id: request.workspace_id || '',
      user_id: request.user_id || '',
      name: request.name || 'Untitled Request',
      type: request.type || 'rest',
      method: request.method || 'GET',
      url: request.url || '',
      headers: request.headers || [],
      params: request.params || [],
      body: normalizedBody,
      bodyType: bodyType,
      auth: request.auth || { type: 'inherit' },
      pre_request_script: request.pre_request_script || '',
      test_script: request.test_script || '',
      settings: request.settings || {
        followRedirects: true,
        timeout: 0,
        maxRedirects: 10
      },
      created_at: request.created_at || new Date().toISOString(),
      updated_at: request.updated_at || new Date().toISOString()
    };
  }
}
