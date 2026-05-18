import { BodyType, HttpMethod, RequestBody } from '../types';
import { PersistenceService } from './PersistenceService';
import { RequestUtils } from '../utils/RequestUtils';
import yaml from 'js-yaml';

export type ImportFormat = 'postman' | 'insomnia' | 'apidog' | 'openapi';

type ImportNode =
  | { type: 'folder'; name: string; children: ImportNode[] }
  | {
    type: 'request';
    name: string;
    request: {
      method: HttpMethod;
      url: string;
      headers: Array<{ key: string; value: string; active: boolean }>;
      params: Array<{ key: string; value: string; active: boolean }>;
      body: RequestBody;
      bodyType: BodyType;
      pre_request_script: string;
      test_script: string;
      auth: any;
    };
  };

type NormalizedImport = {
  name: string;
  variables: Array<{ key: string; value: string; active: boolean }>;
  pre_request_script?: string;
  test_script?: string;
  documentation?: string;
  items: ImportNode[];
};

export type ImportPreview = {
  format: ImportFormat;
  normalized: NormalizedImport;
  stats: {
    folders: number;
    requests: number;
    variables: number;
    scripts: number;
  };
  warnings: string[];
};

export class CollectionImportService {
  static previewImport(raw: string, sourceHint: ImportFormat | 'auto' = 'auto'): ImportPreview {
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      try {
        parsed = yaml.load(raw);
      } catch {
        throw new Error('Invalid JSON or YAML. Please paste or upload a valid export file.');
      }
    }

    const format = sourceHint === 'auto' ? this.detectFormat(parsed) : sourceHint;
    if (!format) {
      throw new Error('Unsupported import format. Supported formats: Postman, API Dog, Insomnia.');
    }

    const normalized =
      format === 'postman'
        ? this.parsePostman(parsed)
        : format === 'insomnia'
          ? this.parseInsomnia(parsed)
          : format === 'apidog'
            ? this.parseApiDog(parsed)
            : this.parseOpenApi(parsed);

    if (!normalized.name || !normalized.items.length) {
      throw new Error('No importable collection data found in this export.');
    }

    const stats = this.collectStats(normalized);
    const warnings: string[] = [];
    if (stats.requests === 0) warnings.push('No requests detected in this file.');

    return { format, normalized, stats, warnings };
  }

  static async importCollection(
    jsonString: string,
    workspaceId: string,
    userId: string,
    sourceHint: ImportFormat | 'auto' = 'auto'
  ) {
    const preview = this.previewImport(jsonString, sourceHint);

    const collection = await PersistenceService.createCollection(workspaceId, userId, preview.normalized.name);
    await PersistenceService.updateCollection(collection.id, {
      variables: preview.normalized.variables,
      pre_request_script: preview.normalized.pre_request_script || '',
      test_script: preview.normalized.test_script || '',
      documentation: preview.normalized.documentation || '',
    } as any);

    await this.importNodes(preview.normalized.items, collection.id, workspaceId, userId, null);
    return { collection, format: preview.format, stats: preview.stats };
  }

  private static detectFormat(parsed: any): ImportFormat | null {
    if (parsed?.info?.schema?.includes('postman') || (parsed?.info?.name && Array.isArray(parsed?.item))) {
      return 'postman';
    }

    if (Array.isArray(parsed?.resources) || parsed?._type === 'export') {
      return 'insomnia';
    }

    if (
      parsed?.apiInfo ||
      parsed?.data?.apiInfo ||
      parsed?.apiTreeList ||
      parsed?.data?.apiTreeList ||
      parsed?.apis ||
      parsed?.data?.apis
    ) {
      return 'apidog';
    }

    if (parsed?.openapi || parsed?.swagger) {
      return 'openapi';
    }

    return null;
  }

  private static parsePostman(collectionData: any): NormalizedImport {
    const name = collectionData?.info?.name || 'Imported Postman Collection';
    const variables = this.mapVariables(collectionData?.variable || []);
    const pre_request_script = this.parsePostmanScript(collectionData?.event, 'prerequest');
    const test_script = this.parsePostmanScript(collectionData?.event, 'test');

    const items = (collectionData?.item || []).map((item: any) => this.parsePostmanItem(item)).filter(Boolean) as ImportNode[];

    return {
      name,
      variables,
      pre_request_script,
      test_script,
      documentation: collectionData?.info?.description || '',
      items,
    };
  }

  private static parsePostmanItem(item: any): ImportNode | null {
    if (Array.isArray(item?.item)) {
      return {
        type: 'folder',
        name: item?.name || 'Folder',
        children: item.item.map((child: any) => this.parsePostmanItem(child)).filter(Boolean) as ImportNode[],
      };
    }

    if (!item?.request) return null;

    const request = item.request;
    const bodyInfo = this.parsePostmanBody(request.body);
    const headers = (request.header || []).map((h: any) => ({
      key: h?.key || '',
      value: h?.value || '',
      active: !h?.disabled,
    }));
    const params = (request?.url?.query || []).map((q: any) => ({
      key: q?.key || '',
      value: q?.value || '',
      active: !q?.disabled,
    }));

    return {
      type: 'request',
      name: item?.name || 'Imported Request',
      request: {
        method: (request.method || 'GET') as HttpMethod,
        url: typeof request.url === 'string' ? request.url : request?.url?.raw || '',
        headers,
        params,
        body: bodyInfo.body,
        bodyType: bodyInfo.bodyType,
        pre_request_script: this.parsePostmanScript(item.event, 'prerequest'),
        test_script: this.parsePostmanScript(item.event, 'test'),
        auth: this.parsePostmanAuth(request.auth),
      },
    };
  }

  private static parsePostmanBody(body: any): { body: RequestBody; bodyType: BodyType } {
    if (!body) return { body: RequestUtils.normalizeRequestBody('', 'none'), bodyType: 'none' };

    let type: BodyType = 'none';
    let content = '';

    if (body.mode === 'raw') {
      const language = body?.options?.raw?.language;
      type = language === 'json' ? 'json' : 'raw';
      content = body.raw || '';
    } else if (body.mode === 'formdata') {
      type = 'form-data';
    } else if (body.mode === 'urlencoded') {
      type = 'urlencoded';
    } else if (body.mode === 'graphql') {
      type = 'graphql';
    }

    const normalizedBody = RequestUtils.normalizeRequestBody(content, type);

    if (type === 'form-data' && Array.isArray(body.formdata)) {
      normalizedBody.formData = body.formdata.map((fd: any) => ({
        id: Math.random().toString(36).substr(2, 9),
        key: fd.key || '',
        value: fd.value || '',
        type: fd.type === 'file' ? 'file' : 'text',
        active: !fd.disabled,
        description: fd.description || ''
      }));
    } else if (type === 'urlencoded' && Array.isArray(body.urlencoded)) {
      normalizedBody.urlencoded = body.urlencoded.map((ue: any) => ({
        id: Math.random().toString(36).substr(2, 9),
        key: ue.key || '',
        value: ue.value || '',
        active: !ue.disabled,
        description: ue.description || ''
      }));
    } else if (type === 'graphql' && body.graphql) {
      normalizedBody.graphql = {
        query: body.graphql.query || '',
        variables: body.graphql.variables || ''
      };
    }

    return { body: normalizedBody, bodyType: type };
  }

  private static parsePostmanScript(events: any[], type: 'prerequest' | 'test') {
    if (!Array.isArray(events)) return '';
    const event = events.find((e: any) => e.listen === type);
    const exec = event?.script?.exec;
    if (exec === undefined || exec === null) return '';
    return Array.isArray(exec) ? exec.join('\n') : String(exec);
  }

  private static parsePostmanAuth(auth: any) {
    if (!auth?.type) return { type: 'inherit' };

    if (auth.type === 'bearer') {
      const token = (auth.bearer || []).find((it: any) => it.key === 'token')?.value || '';
      return { type: 'bearer', bearer: token };
    }

    if (auth.type === 'basic') {
      const username = (auth.basic || []).find((it: any) => it.key === 'username')?.value || '';
      const password = (auth.basic || []).find((it: any) => it.key === 'password')?.value || '';
      return { type: 'basic', basic: { username, password } };
    }

    if (auth.type === 'apikey' || auth.type === 'apiKey') {
      const key = (auth.apikey || auth.apiKey || []).find((it: any) => it.key === 'key')?.value || '';
      const value = (auth.apikey || auth.apiKey || []).find((it: any) => it.key === 'value')?.value || '';
      const addTo = (auth.apikey || auth.apiKey || []).find((it: any) => it.key === 'in')?.value;
      return { type: 'apikey', apiKey: { key, value, addTo: addTo === 'query' ? 'query' : 'header' } };
    }

    return { type: 'inherit' };
  }

  private static parseInsomnia(payload: any): NormalizedImport {
    const resources = Array.isArray(payload?.resources) ? payload.resources : [];
    const workspace = resources.find((r: any) => r._type === 'workspace');
    const groups = resources.filter((r: any) => r._type === 'request_group');
    const requests = resources.filter((r: any) => r._type === 'request');
    const environments = resources.filter((r: any) => r._type === 'environment');

    const parentRoot = workspace?._id;
    const groupChildren = (parentId: string) =>
      groups
        .filter((g: any) => g.parentId === parentId)
        .sort((a: any, b: any) => (a.metaSortKey || 0) - (b.metaSortKey || 0));
    const requestChildren = (parentId: string) =>
      requests
        .filter((r: any) => r.parentId === parentId)
        .sort((a: any, b: any) => (a.metaSortKey || 0) - (b.metaSortKey || 0));

    const parseNode = (parentId: string): ImportNode[] => {
      const folders = groupChildren(parentId).map((g: any) => ({
        type: 'folder' as const,
        name: g.name || 'Folder',
        children: parseNode(g._id),
      }));

      const reqs = requestChildren(parentId).map((r: any) => {
        const headers = (r.headers || []).map((h: any) => ({
          key: h.name || '',
          value: h.value || '',
          active: !h.disabled,
        }));
        const params = (r.parameters || []).map((p: any) => ({
          key: p.name || p.key || '',
          value: p.value || '',
          active: !p.disabled,
        }));

        const mime = r.body?.mimeType || '';
        const bodyType: BodyType = mime.includes('json')
          ? 'json'
          : mime.includes('x-www-form-urlencoded')
            ? 'urlencoded'
            : mime.includes('multipart/form-data')
              ? 'form-data'
              : mime.includes('xml')
                ? 'xml'
                : r.body?.text
                  ? 'raw'
                  : 'none';

        return {
          type: 'request' as const,
          name: r.name || 'Imported Request',
          request: {
            method: (r.method || 'GET') as HttpMethod,
            url: r.url || '',
            headers,
            params,
            body: RequestUtils.normalizeRequestBody(r.body?.text || '', bodyType),
            bodyType,
            pre_request_script: r.preRequestScript || '',
            test_script: r.afterResponseScript || '',
            auth: { type: 'inherit' },
          },
        };
      });

      return [...folders, ...reqs];
    };

    const envVars = environments.flatMap((env: any) => {
      const data = env?.data || {};
      return Object.keys(data).map((key) => ({ key, value: String(data[key] ?? ''), active: true }));
    });

    return {
      name: workspace?.name || 'Imported Insomnia Collection',
      variables: envVars,
      items: parentRoot ? parseNode(parentRoot) : [],
      documentation: payload?.description || '',
    };
  }

  private static parseApiDog(payload: any): NormalizedImport {
    const root = payload?.data || payload;

    // Some API Dog exports are already Postman-compatible.
    if (root?.info?.name && Array.isArray(root?.item)) {
      return this.parsePostman(root);
    }

    const name = root?.apiInfo?.name || root?.name || 'Imported API Dog Collection';
    const vars = this.mapVariables(root?.variables || root?.globalVariables || []);
    const tree = root?.apiTreeList || root?.items || root?.apis || [];

    const parseNode = (node: any): ImportNode | null => {
      const children = node?.children || node?.items || node?.item || [];
      if (Array.isArray(children) && children.length) {
        return {
          type: 'folder',
          name: node?.name || node?.title || 'Folder',
          children: children.map((child: any) => parseNode(child)).filter(Boolean) as ImportNode[],
        };
      }

      const req = node?.request || node;
      if (!req?.method && !(req?.url || req?.path)) return null;

      const headers = this.mapKeyValueArray(req?.headers || req?.header || []);
      const params = this.mapKeyValueArray(req?.params || req?.query || req?.queryParameters || []);

      const bodyRaw = typeof req?.body === 'string' ? req.body : req?.body?.raw || req?.body?.text || '';
      const rawBodyType = req?.bodyType || req?.body?.type || (bodyRaw ? 'raw' : 'none');
      const bodyType = this.normalizeBodyType(rawBodyType);

      return {
        type: 'request',
        name: node?.name || node?.title || 'Imported Request',
        request: {
          method: (req?.method || 'GET') as HttpMethod,
          url: req?.url || req?.path || '',
          headers,
          params,
          body: RequestUtils.normalizeRequestBody(bodyRaw, bodyType),
          bodyType,
          pre_request_script: req?.preRequestScript || req?.pre_script || '',
          test_script: req?.testScript || req?.tests || '',
          auth: { type: 'inherit' },
        },
      };
    };

    return {
      name,
      variables: vars,
      items: (tree || []).map((node: any) => parseNode(node)).filter(Boolean) as ImportNode[],
      documentation: root?.description || '',
    };
  }

  private static parseOpenApi(payload: any): NormalizedImport {
    const title = payload?.info?.title || 'Imported OpenAPI Collection';
    const description = payload?.info?.description || '';

    // Convert paths to requests
    const items: ImportNode[] = [];
    const paths = payload?.paths || {};

    const serverUrl = Array.isArray(payload?.servers) && payload.servers.length > 0
      ? payload.servers[0].url
      : (payload?.host ? `${payload?.schemes?.[0] || 'http'}://${payload.host}${payload.basePath || ''}` : '');

    for (const [path, methods] of Object.entries(paths)) {
      if (typeof methods !== 'object' || !methods) continue;

      for (const [method, operation] of Object.entries(methods)) {
        if (!['get', 'post', 'put', 'patch', 'delete', 'options', 'head'].includes(method.toLowerCase())) continue;

        const op = operation as any;
        const name = op.summary || op.operationId || `${method.toUpperCase()} ${path}`;

        const params: Array<{ key: string; value: string; active: boolean }> = [];
        const headers: Array<{ key: string; value: string; active: boolean }> = [];

        // Parse parameters
        (op.parameters || []).forEach((p: any) => {
          if (p.in === 'query') {
            params.push({ key: p.name, value: '', active: true });
          } else if (p.in === 'header') {
            headers.push({ key: p.name, value: '', active: true });
          }
        });

        let bodyContent = '';
        let bodyType: BodyType = 'none';

        // Parse requestBody (OpenAPI 3)
        if (op.requestBody?.content) {
          const content = op.requestBody.content;
          if (content['application/json']) {
            bodyType = 'json';
            const schema = content['application/json'].schema;
            if (schema && schema.type === 'object') {
              bodyContent = '{\n}';
            }
          } else if (content['application/x-www-form-urlencoded']) {
            bodyType = 'urlencoded';
          } else if (content['multipart/form-data']) {
            bodyType = 'form-data';
          } else if (content['application/xml']) {
            bodyType = 'xml';
          } else {
            bodyType = 'raw';
          }
        }

        const body = RequestUtils.normalizeRequestBody(bodyContent, bodyType);

        // Extract tags to use as folders
        const tags = op.tags || ['Default'];
        const tag = tags[0];

        const reqNode: ImportNode = {
          type: 'request',
          name,
          request: {
            method: method.toUpperCase() as HttpMethod,
            url: `${serverUrl}${path}`,
            headers,
            params,
            body,
            bodyType,
            pre_request_script: '',
            test_script: '',
            auth: { type: 'inherit' }
          }
        };

        // Find or create folder
        let folder = items.find(i => i.type === 'folder' && i.name === tag) as { type: 'folder', name: string, children: ImportNode[] };
        if (!folder) {
          folder = { type: 'folder', name: tag, children: [] };
          items.push(folder);
        }
        folder.children.push(reqNode);
      }
    }

    return {
      name: title,
      variables: [],
      items,
      documentation: description
    };
  }

  private static mapVariables(list: any[]): Array<{ key: string; value: string; active: boolean }> {
    if (!Array.isArray(list)) return [];
    return list
      .map((v: any) => ({
        key: v?.key || v?.name || '',
        value: String(v?.value ?? ''),
        active: !(v?.disabled || v?.enable === false),
      }))
      .filter((v) => !!v.key);
  }

  private static mapKeyValueArray(list: any[]): Array<{ key: string; value: string; active: boolean }> {
    if (!Array.isArray(list)) return [];
    return list
      .map((v: any) => ({
        key: v?.key || v?.name || '',
        value: String(v?.value ?? ''),
        active: !(v?.disabled || v?.enable === false),
      }))
      .filter((v) => !!v.key);
  }

  private static normalizeBodyType(type: string): BodyType {
    const normalized = String(type || '').toLowerCase();
    if (normalized === 'json') return 'json';
    if (normalized === 'formdata' || normalized === 'form-data') return 'form-data';
    if (normalized === 'urlencoded' || normalized === 'form-urlencoded') return 'urlencoded';
    if (normalized === 'graphql') return 'graphql';
    if (normalized === 'raw' || normalized === 'text') return 'raw';
    return 'none';
  }

  private static collectStats(normalized: NormalizedImport) {
    let folders = 0;
    let requests = 0;
    let scripts = 0;

    const visit = (nodes: ImportNode[]) => {
      nodes.forEach((node) => {
        if (node.type === 'folder') {
          folders += 1;
          visit(node.children);
        } else {
          requests += 1;
          if (node.request.pre_request_script) scripts += 1;
          if (node.request.test_script) scripts += 1;
        }
      });
    };

    visit(normalized.items);

    return {
      folders,
      requests,
      variables: normalized.variables.length,
      scripts,
    };
  }

  private static async importNodes(
    nodes: ImportNode[],
    collectionId: string,
    workspaceId: string,
    userId: string,
    folderId: string | null
  ) {
    for (const node of nodes) {
      if (node.type === 'folder') {
        const folder = await PersistenceService.createFolder(node.name, collectionId, userId, folderId || undefined, workspaceId);
        await this.importNodes(node.children, collectionId, workspaceId, userId, folder.id);
      } else {
        await PersistenceService.createRequest({
          collection_id: collectionId,
          folder_id: folderId,
          workspace_id: workspaceId,
          user_id: userId,
          name: node.name,
          type: 'rest',
          method: node.request.method,
          url: node.request.url,
          headers: node.request.headers,
          params: node.request.params,
          body: node.request.body, // This is already a RequestBody object
          bodyType: node.request.bodyType,
          pre_request_script: node.request.pre_request_script,
          test_script: node.request.test_script,
          auth: node.request.auth,
        } as any);
      }
    }
  }
}
