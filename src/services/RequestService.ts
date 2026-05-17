import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { RequestData, ResponseData, KeyValue, AuthConfig, Collection } from '../types';
import { VariableService } from './VariableService';
import { AuthService } from './AuthService';
import { useStore } from '../store/useStore';

export class RequestService {
  static async execute(request: RequestData, context: {
    environments: any[];
    activeEnvId: string | null;
    collections: Collection[];
    workspaceVariables?: KeyValue[];
    variables?: Record<string, any>;
  }): Promise<ResponseData> {
    const state = useStore.getState();
    const globalSettings = state.settings;
    const start = Date.now();
    
    // 1. Find Collection for Auth Inheritance
    const activeCollection = context.collections.find(c => c.id === request.collection_id) || null;
    const variableContext = { ...context, collection: activeCollection };

    // 3. Resolve variables
    const resolvedUrl = VariableService.resolve(request.url, variableContext);
    const resolvedHeaders = this.resolveKeyValues(request.headers, variableContext);
    const resolvedParams = this.resolveKeyValues(request.params, variableContext);
    
    // Normalize body if it's a string (legacy)
    const body = typeof request.body === 'string' 
      ? { type: request.bodyType, content: request.body } as any 
      : request.body;

    // 4. Prepare Axios Config
    const config: AxiosRequestConfig = {
      url: resolvedUrl,
      method: request.method,
      headers: this.mapHeaders(resolvedHeaders),
      params: this.mapParams(resolvedParams),
      data: this.prepareBody(body, request.bodyType, variableContext),
      validateStatus: () => true,
      
      // Global Settings Merged with Overrides
      timeout: request.settings?.timeout || globalSettings.general.requestTimeout || 0,
      maxRedirects: request.settings?.maxRedirects || globalSettings.general.maxRedirects || 10,
      maxContentLength: globalSettings.general.maxResponseSize,
    };

    // 5. Apply Auth (Inheritance handled here)
    const effectiveAuth = AuthService.getEffectiveAuth(request, context.collections);
    this.applyAuth(config, effectiveAuth, variableContext);

    try {
      const response: AxiosResponse = await axios(config);
      const end = Date.now();

      return {
        id: Math.random().toString(36).substr(2, 9),
        status: response.status,
        statusText: response.statusText,
        headers: response.headers as any,
        body: response.data,
        time: end - start,
        size: typeof response.data === 'string' ? response.data.length : JSON.stringify(response.data).length,
        contentType: String(response.headers['content-type'] || 'text/plain'),
      };
    } catch (error: any) {
      const end = Date.now();
      return {
        id: Math.random().toString(36).substr(2, 9),
        status: 0,
        statusText: error.message || 'Network Error',
        headers: {},
        body: error.response?.data || error.stack || 'Request failed',
        time: end - start,
        size: 0,
        contentType: 'text/plain',
      };
    }
  }

  private static resolveKeyValues(items: KeyValue[], context: any): KeyValue[] {
    if (!items) return [];
    return items.map(item => ({
      ...item,
      key: VariableService.resolve(item.key, context),
      value: VariableService.resolve(item.value, context),
    }));
  }

  private static mapHeaders(headers: KeyValue[]): Record<string, string> {
    const result: Record<string, string> = {};
    headers.forEach(h => {
      if (h.active && h.key) result[h.key] = String(h.value);
    });
    return result;
  }

  private static mapParams(params: KeyValue[]): Record<string, string> {
    const result: Record<string, string> = {};
    params.forEach(p => {
      if (p.active && p.key) result[p.key] = p.value;
    });
    return result;
  }

  private static prepareBody(body: any, type: string, context: any): any {
    if (!body || type === 'none') return null;

    if (type === 'json') {
      const resolved = VariableService.resolve(body.content || '', context);
      try {
        return JSON.parse(resolved);
      } catch {
        return resolved;
      }
    }

    if (type === 'form-data') {
      const formData = new FormData();
      (body.formData || []).forEach((item: any) => {
        if (!item || !item.active || !item.key) return;
        if (item.type === 'file' && item.file) {
          formData.append(item.key, item.file);
        } else {
          formData.append(item.key, VariableService.resolve(item.value || '', context));
        }
      });
      return formData;
    }

    if (type === 'urlencoded') {
      const params = new URLSearchParams();
      (body.urlencoded || []).forEach((item: any) => {
        if (item && item.active && item.key) {
          params.append(item.key, VariableService.resolve(item.value || '', context));
        }
      });
      return params;
    }

    if (type === 'graphql') {
      const query = VariableService.resolve(body.graphql?.query || '', context);
      const variablesStr = VariableService.resolve(body.graphql?.variables || '{}', context);
      try {
        const variables = JSON.parse(variablesStr);
        return { query, variables };
      } catch {
        return { query, variables: {} };
      }
    }

    if (type === 'binary') {
      return body.binary?.file || null;
    }

    // Default: raw, xml, etc.
    return VariableService.resolve(body.content || '', context);
  }

  private static applyAuth(config: AxiosRequestConfig, auth: AuthConfig, context: any) {
    if (!auth || auth.type === 'none') return;

    if (auth.type === 'bearer' && auth.bearer) {
      const token = VariableService.resolve(auth.bearer, context);
      config.headers = { ...config.headers, Authorization: `Bearer ${token}` };
    }

    if (auth.type === 'basic' && auth.basic) {
      const user = VariableService.resolve(auth.basic.username || '', context);
      const pass = VariableService.resolve(auth.basic.password || '', context);
      const encoded = btoa(`${user}:${pass}`);
      config.headers = { ...config.headers, Authorization: `Basic ${encoded}` };
    }

    if (auth.type === 'apikey' && auth.apiKey) {
      const key = VariableService.resolve(auth.apiKey.key, context);
      const value = VariableService.resolve(auth.apiKey.value, context);
      if (auth.apiKey.addTo === 'header') {
        config.headers = { ...config.headers, [key]: value };
      } else {
        config.params = { ...config.params, [key]: value };
      }
    }

    if (auth.type === 'oauth2' && auth.oauth2) {
      const token = VariableService.resolve(auth.oauth2.accessToken || '', context);
      const type = auth.oauth2.tokenType || 'Bearer';
      if (token) {
        config.headers = { ...config.headers, Authorization: `${type} ${token}` };
      }
    }
  }
}
