import { Collection, Folder, RequestData } from '../types';

export enum ExportFormat {
  POSTMAN = 'postman',
  INSOMNIA = 'insomnia',
  HOPPSCOTCH = 'hoppscotch',
  BRUNO = 'bruno',
  OPENAPI_V3 = 'openapi_v3',
  CURL_BUNDLE = 'curl_bundle',
  JSON = 'json'
}

export class CollectionExportService {
  static exportCollection(collection: Collection, format: ExportFormat = ExportFormat.POSTMAN) {
    if (format === ExportFormat.CURL_BUNDLE) {
      return this.exportCurlBundle(collection);
    }
    const postmanCollection = {
      info: {
        name: collection.name,
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        _postman_id: collection.id,
        description: collection.description || ''
      },
      item: this.processItems(collection),
      event: this.processScripts(collection.pre_request_script, collection.test_script),
      variable: (collection.variables || []).map(v => ({
        key: v.key,
        value: v.value,
        type: 'string'
      })),
      auth: this.processAuth(collection.auth)
    };

    const blob = new Blob([JSON.stringify(postmanCollection, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${collection.name.replace(/\s+/g, '_')}.postman_collection.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  static pruneCollection(collection: Collection, selectedIds: Set<string>): Collection {
    const pruned = JSON.parse(JSON.stringify(collection));
    // Implementation to remove non-selected items
    const filterNodes = (nodes: any[]): any[] => {
      return nodes.filter(node => selectedIds.has(node.id)).map(node => {
        if (node.folders) node.folders = filterNodes(node.folders);
        if (node.requests) node.requests = node.requests.filter((r: any) => selectedIds.has(r.id));
        return node;
      });
    };
    if (pruned.folders) pruned.folders = filterNodes(pruned.folders);
    if (pruned.requests) pruned.requests = pruned.requests.filter((r: any) => selectedIds.has(r.id));
    return pruned;
  }

  static exportCurlBundle(collection: Collection) {
    let script = '#!/bin/bash\n\n';
    const processItems = (items: any[]) => {
      items.forEach(item => {
        if (item.method && item.url) {
          script += `curl -X ${item.method} "${item.url}" \\\n`;
          (item.headers || []).forEach((h: any) => {
            if (h.active) script += `  -H "${h.key}: ${h.value}" \\\n`;
          });
          script += '\n';
        }
      });
    };
    processItems(collection.requests || []);
    
    const blob = new Blob([script], { type: 'text/x-shellscript' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${collection.name.replace(/\s+/g, '_')}.sh`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  private static processItems(collection: Collection): any[] {
    const items: any[] = [];

    // Map folders
    (collection.folders || []).forEach(folder => {
      items.push(this.mapFolderToItem(folder));
    });

    // Map root requests
    (collection.requests || []).filter(r => !r.folder_id).forEach(request => {
      items.push(this.mapRequestToItem(request));
    });

    return items;
  }

  private static mapFolderToItem(folder: Folder): any {
    return {
      name: folder.name,
      item: [
        ...(folder.folders || []).map(f => this.mapFolderToItem(f)),
        ...(folder.requests || []).map(r => this.mapRequestToItem(r))
      ],
      description: folder.description || '',
      event: this.processScripts('', ''), // Folders can have scripts but we use inheritance logic
      auth: this.processAuth(folder.auth)
    };
  }

  private static mapRequestToItem(request: RequestData): any {
    return {
      name: request.name,
      request: {
        method: request.method,
        header: (request.headers || []).map(h => ({
          key: h.key,
          value: h.value,
          disabled: !h.active
        })),
        body: this.processBody(request.body, request.bodyType),
        url: {
          raw: request.url,
          protocol: request.url.split('://')[0],
          host: request.url.split('://')[1]?.split('/')[0].split('.') || [],
          path: request.url.split('://')[1]?.split('/').slice(1) || [],
          query: (request.params || []).map(p => ({
            key: p.key,
            value: p.value,
            disabled: !p.active
          }))
        },
        auth: this.processAuth(request.auth),
        description: ''
      },
      event: this.processScripts(request.pre_request_script, request.test_script)
    };
  }

  private static processScripts(preRequest?: string, test?: string) {
    const events = [];
    if (preRequest) {
      events.push({
        listen: 'prerequest',
        script: {
          type: 'text/javascript',
          exec: preRequest.split('\n')
        }
      });
    }
    if (test) {
      events.push({
        listen: 'test',
        script: {
          type: 'text/javascript',
          exec: test.split('\n')
        }
      });
    }
    return events;
  }

  private static processAuth(auth: any) {
    if (!auth || auth.type === 'inherit') return null;
    return {
      type: auth.type,
      [auth.type]: Object.entries(auth.config || {}).map(([key, value]) => ({
        key,
        value,
        type: 'string'
      }))
    };
  }

  private static processBody(body: any, type: string) {
    if (type === 'none') return null;
    return {
      mode: type === 'json' ? 'raw' : type,
      raw: body,
      options: type === 'json' ? { raw: { language: 'json' } } : undefined
    };
  }
}
