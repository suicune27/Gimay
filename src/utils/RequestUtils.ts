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

    // 1. Try to parse if it is a JSON string of a RequestBody object
    let parsed: any = body;
    if (typeof body === 'string') {
      const trimmed = body.trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
          parsed = JSON.parse(trimmed);
        } catch {
          // Keep as string
        }
      }
    }

    // 2. If it is or became an object, resolve its structure
    if (typeof parsed === 'object' && parsed !== null) {
      // Check if it's already our RequestBody structure or has normalized parts
      const isRequestBody = 'type' in parsed || 'content' in parsed || 'formData' in parsed || 'urlencoded' in parsed;
      if (isRequestBody) {
        return {
          ...defaultBody,
          ...parsed,
          type: parsed.type || type || 'none',
          graphql: {
            ...defaultBody.graphql,
            ...(parsed.graphql || {})
          }
        };
      }
      
      // Handle Postman request body mode if it slipped through raw
      if ('mode' in parsed) {
        const mode = parsed.mode;
        const rawContent = parsed.raw || '';
        let resolvedType: BodyType = 'none';
        if (mode === 'raw') {
          const lang = parsed?.options?.raw?.language;
          resolvedType = lang === 'json' ? 'json' : 'raw';
        } else if (mode === 'formdata') {
          resolvedType = 'form-data';
        } else if (mode === 'urlencoded') {
          resolvedType = 'urlencoded';
        } else if (mode === 'graphql') {
          resolvedType = 'graphql';
        }
        
        const returnBody = {
          ...defaultBody,
          type: resolvedType,
          content: resolvedType === 'json' || resolvedType === 'raw' ? rawContent : ''
        };
        
        if (resolvedType === 'form-data' && Array.isArray(parsed.formdata)) {
          returnBody.formData = parsed.formdata.map((fd: any) => ({
            id: Math.random().toString(36).substr(2, 9),
            key: fd.key || '',
            value: fd.value || '',
            type: fd.type === 'file' ? 'file' : 'text',
            active: !fd.disabled,
            description: fd.description || ''
          }));
        } else if (resolvedType === 'urlencoded' && Array.isArray(parsed.urlencoded)) {
          returnBody.urlencoded = parsed.urlencoded.map((ue: any) => ({
            id: Math.random().toString(36).substr(2, 9),
            key: ue.key || '',
            value: ue.value || '',
            active: !ue.disabled,
            description: ue.description || ''
          }));
        } else if (resolvedType === 'graphql' && parsed.graphql) {
          returnBody.graphql = {
            query: parsed.graphql.query || '',
            variables: parsed.graphql.variables || ''
          };
        }
        
        return returnBody;
      }
      
      // Handle Insomnia request body if it slipped through raw
      if ('mimeType' in parsed) {
        const mime = parsed.mimeType || '';
        const text = parsed.text || '';
        let resolvedType: BodyType = 'none';
        if (mime.includes('json')) {
          resolvedType = 'json';
        } else if (mime.includes('x-www-form-urlencoded')) {
          resolvedType = 'urlencoded';
        } else if (mime.includes('multipart/form-data')) {
          resolvedType = 'form-data';
        } else if (mime.includes('xml')) {
          resolvedType = 'xml';
        } else if (text) {
          resolvedType = 'raw';
        }
        
        return {
          ...defaultBody,
          type: resolvedType,
          content: resolvedType === 'json' || resolvedType === 'raw' || resolvedType === 'xml' ? text : ''
        };
      }
    }

    // 3. Fallback: treat as plain string
    const bodyStr = typeof body === 'string' ? body : '';
    
    const normalized = { ...defaultBody, type };

    if (type === 'json' || type === 'raw' || type === 'xml') {
      normalized.content = bodyStr;
    } else if (type === 'graphql') {
      try {
        const parsedQL = JSON.parse(bodyStr);
        normalized.graphql = {
          query: parsedQL.query || '',
          variables: typeof parsedQL.variables === 'string' ? parsedQL.variables : JSON.stringify(parsedQL.variables || {}, null, 2)
        };
      } catch {
        normalized.graphql.query = bodyStr;
      }
    } else if (type === 'form-data') {
      normalized.formData = [];
    } else if (type === 'urlencoded') {
      normalized.urlencoded = [];
    }

    return normalized;
  }

  static normalizeRequest(request: Partial<RequestData>): RequestData {
    const bodyType = request.bodyType || (request as any).body_type || 'none';
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
