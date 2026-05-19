import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { RequestData, ResponseData, KeyValue, AuthConfig, Collection } from '../types';
import { VariableService } from './VariableService';
import { AuthService } from './AuthService';
import { useStore } from '../store/useStore';
import { isElectron } from '../lib/platform';
import { ProxyService } from './ProxyService';

interface NetworkDiagnostic {
  errorType: 'DNS_FAILURE' | 'SSL_ERROR' | 'CORS_ERROR' | 'TIMEOUT' | 'OFFLINE' | 'PROXY_ERROR' | 'CONNECTION_REFUSED' | 'GENERIC_ERROR';
  message: string;
  recommendation: string;
}

export class RequestService {
  private static diagnoseError(error: any, isWeb: boolean): NetworkDiagnostic {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return {
        errorType: 'OFFLINE',
        message: 'System is offline.',
        recommendation: 'Check your internet connection or network adapter.'
      };
    }

    const code = error?.code || '';
    const message = (error?.message || '').toLowerCase();

    if (code === 'ECONNABORTED' || message.includes('timeout') || message.includes('exceeded')) {
      return {
        errorType: 'TIMEOUT',
        message: 'Request timed out.',
        recommendation: 'Increase the timeout setting in the request or general settings.'
      };
    }

    if (code === 'ENOTFOUND' || message.includes('enotfound') || message.includes('dns')) {
      return {
        errorType: 'DNS_FAILURE',
        message: 'DNS resolution failed. Hostname could not be resolved.',
        recommendation: 'Check your DNS settings or ensure the domain name is spelled correctly.'
      };
    }

    if (message.includes('ssl') || message.includes('cert') || message.includes('tls') || code.includes('DEPTH_ZERO_SELF_SIGNED_CERT')) {
      return {
        errorType: 'SSL_ERROR',
        message: 'SSL/TLS handshake or certificate verification failed.',
        recommendation: 'Disable "SSL Verification" in SSL/TLS settings if using self-signed development certificates.'
      };
    }

    if (message.includes('proxy') || code.includes('PROXY')) {
      return {
        errorType: 'PROXY_ERROR',
        message: 'Failed to establish connection through proxy.',
        recommendation: 'Verify that your active proxy server is running, authenticated, and reachable.'
      };
    }

    if (code === 'ECONNREFUSED' || message.includes('refused')) {
      return {
        errorType: 'CONNECTION_REFUSED',
        message: 'Connection refused by target server.',
        recommendation: 'Check if the target server is active and listening on the specified port.'
      };
    }

    if (isWeb && (message.includes('network error') || (error?.isAxiosError && !error?.response))) {
      return {
        errorType: 'CORS_ERROR',
        message: 'CORS policy blocked request or network link was cut.',
        recommendation: 'Verify the target server allows CORS from your origin, or use the Desktop version of the application to bypass browser CORS sandbox restrictions.'
      };
    }

    return {
      errorType: 'GENERIC_ERROR',
      message: error?.message || 'An unknown network error occurred.',
      recommendation: 'Check browser/application console logs or verify the target endpoint directly.'
    };
  }

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
    
    // 3.5. Inject Network Chaos Fuzzer
    const isChaosEnabled = (request.settings as any)?.chaosEnabled ?? false;
    if (isChaosEnabled) {
      // 1. Latency Jitter simulation
      const minDelay = (request.settings as any)?.chaosMinDelay ?? 0;
      const maxDelay = (request.settings as any)?.chaosMaxDelay ?? 0;
      if (maxDelay > minDelay) {
        const jitter = Math.floor(Math.random() * (maxDelay - minDelay) + minDelay);
        await new Promise(resolve => setTimeout(resolve, jitter));
      }

      // 2. HTTP Status Failure Fuzzing
      const failureRate = (request.settings as any)?.chaosFailureRate ?? 0;
      if (Math.random() * 100 < failureRate) {
        const end = Date.now();
        const fuzzedErrors = [
          { status: 408, text: 'Request Timeout (Fuzzed)', msg: 'Target timeout limit exceeded.' },
          { status: 429, text: 'Too Many Requests (Fuzzed)', msg: 'API Rate limit throttled by Chaos Fuzzer.' },
          { status: 500, text: 'Internal Server Error (Fuzzed)', msg: 'Simulated backend database collision.' },
          { status: 503, text: 'Service Unavailable (Fuzzed)', msg: 'Backend instance reported unhealthy.' },
          { status: 504, text: 'Gateway Timeout (Fuzzed)', msg: 'Ingress proxy socket dropped link.' }
        ];
        const errorTemplate = fuzzedErrors[Math.floor(Math.random() * fuzzedErrors.length)];
        
        return {
          id: Math.random().toString(36).substr(2, 9),
          status: errorTemplate.status,
          statusText: `Chaos Intercept: ${errorTemplate.text}`,
          headers: { 'x-gimay-chaos': 'active' },
          body: JSON.stringify({
            error: errorTemplate.text,
            message: errorTemplate.msg,
            recommendation: 'Verify your client application handles network retries, throttles, and server crash screens gracefully.'
          }, null, 2),
          time: end - start,
          size: 0,
          contentType: 'application/json',
          request_config: {
            runtimeEnv: isElectron() ? 'Electron/Desktop' : 'Web Browser',
            chaosFuzzer: 'Active intercept'
          }
        };
      }
    }

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
      
      // Let browser/Electron native Chromium stack handle proxies and network
      proxy: false,
      
      // Global Settings Merged with Overrides
      timeout: request.settings?.timeout || globalSettings.general.requestTimeout || 0,
      maxRedirects: request.settings?.maxRedirects || globalSettings.general.maxRedirects || 10,
      maxContentLength: globalSettings.general.maxResponseSize,
    };

    // 5. Apply Auth (Inheritance handled here)
    const effectiveAuth = AuthService.getEffectiveAuth(request, context.collections);
    this.applyAuth(config, effectiveAuth, variableContext);

    // Resolve Proxy for Diagnostics and Execution Context
    const resolvedProxy = await ProxyService.resolveProxy(resolvedUrl);

    // Retry settings
    const retryCount = globalSettings.general.retryCount || 0;
    const retryDelay = globalSettings.general.retryDelay || 1000;

    let response: AxiosResponse | null = null;
    let lastError: any = null;
    let attempts = 0;

    const useWebProxy = !isElectron(); // In browser, route requests through local CORS proxy server to bypass sandbox CORS restrictions!

    while (attempts <= retryCount) {
      try {
        if (useWebProxy) {
          // Route request through our internal Express CORS proxy bridge
          let requestData = config.data;
          if (requestData && (requestData instanceof URLSearchParams || requestData.constructor?.name === 'URLSearchParams' || typeof requestData.append === 'function')) {
            requestData = requestData.toString();
          }

          const proxyResponse = await axios.post('/api/proxy', {
            method: config.method,
            url: config.url,
            headers: config.headers,
            data: requestData,
            params: config.params
          });

          // Map the proxy's server-to-server request response to look exactly like standard AxiosResponse
          response = {
            status: proxyResponse.data.status,
            statusText: proxyResponse.data.statusText,
            headers: proxyResponse.data.headers,
            data: proxyResponse.data.data,
            config: config,
            headersText: ''
          } as AxiosResponse;
        } else {
          // In Electron native process, direct axios works perfectly
          response = await axios(config);
        }
        break; // Success! Break loop
      } catch (error: any) {
        // If the error comes from our CORS proxy server, extract the original underlying server message
        if (error.response?.data?.error) {
          lastError = new Error(error.response.data.error);
          if (error.response.data.details) {
            lastError.stack = typeof error.response.data.details === 'string' 
              ? error.response.data.details 
              : JSON.stringify(error.response.data.details);
          }
        } else {
          lastError = error;
        }
        attempts++;
        if (attempts <= retryCount) {
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
        }
      }
    }

    const end = Date.now();

    if (response) {
      return {
        id: Math.random().toString(36).substr(2, 9),
        status: response.status,
        statusText: response.statusText,
        headers: response.headers as any,
        body: response.data,
        time: end - start,
        size: typeof response.data === 'string' ? response.data.length : JSON.stringify(response.data).length,
        contentType: String(response.headers['content-type'] || 'text/plain'),
        request_config: {
          resolvedProxy,
          runtimeEnv: isElectron() ? 'Electron/Desktop' : 'Web Browser',
          sslStatus: globalSettings.ssl.verifySSL ? 'Strict (Verified)' : 'Disabled'
        }
      };
    } else {
      let diagnostics = this.diagnoseError(lastError, !isElectron());
      let traceSteps: any[] = [];

      if (isElectron() && typeof (window as any).electron?.runNetworkDiagnostics === 'function') {
        try {
          const nativeDiag = await (window as any).electron.runNetworkDiagnostics(resolvedUrl);
          if (nativeDiag) {
            diagnostics = {
              errorType: nativeDiag.errorType,
              message: nativeDiag.message,
              recommendation: nativeDiag.recommendation
            };
            traceSteps = nativeDiag.steps || [];
          }
        } catch (diagErr) {
          console.error('[RequestService] Native socket diagnostics tracer failed:', diagErr);
        }
      }

      return {
        id: Math.random().toString(36).substr(2, 9),
        status: 0,
        statusText: `Network Error: ${diagnostics.errorType}`,
        headers: {},
        body: JSON.stringify({
          error: lastError?.message || 'Network Error',
          diagnostics: {
            type: diagnostics.errorType,
            message: diagnostics.message,
            recommendation: diagnostics.recommendation,
            trace: traceSteps.length > 0 ? traceSteps : undefined
          },
          details: lastError?.stack || 'Request execution failed after retries'
        }, null, 2),
        time: end - start,
        size: 0,
        contentType: 'application/json',
        request_config: {
          resolvedProxy,
          runtimeEnv: isElectron() ? 'Electron/Desktop' : 'Web Browser',
          sslStatus: globalSettings.ssl.verifySSL ? 'Strict (Verified)' : 'Disabled'
        }
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
        if (!item || item.active === false || !item.key) return;
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
        if (item && item.active !== false && item.key) {
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
