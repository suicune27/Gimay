import { Collection, Folder, RequestData } from '../types';

export enum ExportFormat {
  POSTMAN = 'postman',
  INSOMNIA = 'insomnia',
  HOPPSCOTCH = 'hoppscotch',
  BRUNO = 'bruno',
  OPENAPI_V3 = 'openapi_v3',
  CURL_BUNDLE = 'curl_bundle',
  JSON = 'json',
  JMETER = 'jmeter'
}

export class CollectionExportService {
  static exportCollection(collection: Collection, format: ExportFormat = ExportFormat.POSTMAN) {
    if (format === ExportFormat.CURL_BUNDLE) {
      return this.exportCurlBundle(collection);
    }
    if (format === ExportFormat.JMETER) {
      return this.exportJMeter(collection);
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

  static exportJMeter(collection: Collection) {
    const escapeXml = (unsafe: string) => {
      if (!unsafe) return '';
      return unsafe.replace(/[<>&'"]/g, (c) => {
        switch (c) {
          case '<': return '&lt;';
          case '>': return '&gt;';
          case '&': return '&amp;';
          case '\'': return '&apos;';
          case '"': return '&quot;';
          default: return c;
        }
      });
    };

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<jmeterTestPlan version="1.2" properties="5.0" jmeter="5.4.1">
  <hashTree>
    <TestPlan guiclass="TestPlanGui" testclass="TestPlan" testname="${escapeXml(collection.name)}" enabled="true">
      <stringProp name="TestPlan.comments">${escapeXml(collection.description || '')}</stringProp>
      <boolProp name="TestPlan.functional_mode">false</boolProp>
      <boolProp name="TestPlan.tearDown_on_shutdown">true</boolProp>
      <boolProp name="TestPlan.serialize_threadgroups">false</boolProp>
      <elementProp name="TestPlan.user_defined_variables" elementType="Arguments" guiclass="ArgumentsPanel" testclass="Arguments" testname="User Defined Variables" enabled="true">
        <collectionProp name="Arguments.arguments">`;

    (collection.variables || []).forEach(v => {
      xml += `
          <elementProp name="${escapeXml(v.key)}" elementType="Argument">
            <stringProp name="Argument.name">${escapeXml(v.key)}</stringProp>
            <stringProp name="Argument.value">${escapeXml(v.value)}</stringProp>
            <stringProp name="Argument.metadata">=</stringProp>
          </elementProp>`;
    });

    xml += `
        </collectionProp>
      </elementProp>
      <stringProp name="TestPlan.user_define_classpath"></stringProp>
    </TestPlan>
    <hashTree>
      <ThreadGroup guiclass="ThreadGroupGui" testclass="ThreadGroup" testname="Thread Group" enabled="true">
        <stringProp name="ThreadGroup.on_sample_error">continue</stringProp>
        <elementProp name="ThreadGroup.main_controller" elementType="LoopController" guiclass="LoopControlPanel" testclass="LoopController" testname="Loop Controller" enabled="true">
          <boolProp name="LoopController.continue_forever">false</boolProp>
          <stringProp name="LoopController.loops">1</stringProp>
        </elementProp>
        <stringProp name="ThreadGroup.num_threads">1</stringProp>
        <stringProp name="ThreadGroup.ramp_time">1</stringProp>
        <boolProp name="ThreadGroup.scheduler">false</boolProp>
        <stringProp name="ThreadGroup.duration"></stringProp>
        <stringProp name="ThreadGroup.delay"></stringProp>
        <boolProp name="ThreadGroup.same_user_on_next_iteration">true</boolProp>
      </ThreadGroup>
      <hashTree>`;

    const requests: RequestData[] = [];
    const collectRequests = (node: any) => {
      if (node.requests) {
        node.requests.forEach((r: any) => requests.push(r));
      }
      if (node.folders) {
        node.folders.forEach((f: any) => collectRequests(f));
      }
    };
    
    collectRequests(collection);

    requests.forEach((req) => {
      let protocol = 'http';
      let domain = '';
      let port = '';
      let path = '';

      try {
        if (req.url) {
          const urlStr = req.url.trim();
          if (urlStr.startsWith('http://') || urlStr.startsWith('https://')) {
            const urlObj = new URL(urlStr);
            protocol = urlObj.protocol.replace(':', '');
            domain = urlObj.hostname;
            port = urlObj.port;
            path = urlObj.pathname + urlObj.search;
          } else {
            path = urlStr;
          }
        }
      } catch {
        path = req.url || '';
      }

      const hasRawBody = req.bodyType === 'json' || req.bodyType === 'raw' || req.bodyType === 'xml';
      const bodyContent = typeof req.body === 'string' ? req.body : req.body?.content || '';

      xml += `
        <HTTPSamplerProxy guiclass="HttpTestSampleGui" testclass="HTTPSamplerProxy" testname="${escapeXml(req.name)}" enabled="true">`;

      if (hasRawBody && bodyContent) {
        xml += `
          <boolProp name="HTTPSampler.postBodyRaw">true</boolProp>
          <elementProp name="HTTPsampler.Arguments" elementType="Arguments">
            <collectionProp name="Arguments.arguments">
              <elementProp name="" elementType="HTTPArgument">
                <boolProp name="HTTPArgument.always_encode">false</boolProp>
                <stringProp name="Argument.value">${escapeXml(bodyContent)}</stringProp>
                <stringProp name="Argument.metadata">=</stringProp>
              </elementProp>
            </collectionProp>
          </elementProp>`;
      } else {
        xml += `
          <elementProp name="HTTPsampler.Arguments" elementType="Arguments" guiclass="HTTPArgumentsPanel" testclass="Arguments" testname="User Defined Variables" enabled="true">
            <collectionProp name="Arguments.arguments">`;
        
        (req.params || []).forEach(p => {
          if (p.active) {
            xml += `
              <elementProp name="${escapeXml(p.key)}" elementType="HTTPArgument">
                <boolProp name="HTTPArgument.always_encode">true</boolProp>
                <stringProp name="Argument.value">${escapeXml(p.value)}</stringProp>
                <stringProp name="Argument.metadata">=</stringProp>
                <boolProp name="HTTPArgument.use_equals">true</boolProp>
                <stringProp name="Argument.name">${escapeXml(p.key)}</stringProp>
              </elementProp>`;
          }
        });

        xml += `
            </collectionProp>
          </elementProp>`;
      }

      xml += `
          <stringProp name="HTTPSampler.domain">${escapeXml(domain)}</stringProp>
          <stringProp name="HTTPSampler.port">${escapeXml(port)}</stringProp>
          <stringProp name="HTTPSampler.protocol">${escapeXml(protocol)}</stringProp>
          <stringProp name="HTTPSampler.contentEncoding">UTF-8</stringProp>
          <stringProp name="HTTPSampler.path">${escapeXml(path)}</stringProp>
          <stringProp name="HTTPSampler.method">${escapeXml(req.method || 'GET')}</stringProp>
          <boolProp name="HTTPSampler.follow_redirects">true</boolProp>
          <boolProp name="HTTPSampler.auto_redirects">false</boolProp>
          <boolProp name="HTTPSampler.use_keepalive">true</boolProp>
          <boolProp name="HTTPSampler.DO_MULTIPART_POST">false</boolProp>
          <stringProp name="HTTPSampler.embedded_url_re"></stringProp>
          <stringProp name="HTTPSampler.connect_timeout"></stringProp>
          <stringProp name="HTTPSampler.response_timeout"></stringProp>
        </HTTPSamplerProxy>
        <hashTree>`;

      const activeHeaders = (req.headers || []).filter(h => h.active);
      if (activeHeaders.length > 0) {
        xml += `
          <HeaderManager guiclass="HeaderPanel" testclass="HeaderManager" testname="HTTP Header Manager" enabled="true">
            <collectionProp name="HeaderManager.headers">`;
        
        activeHeaders.forEach(h => {
          xml += `
              <elementProp name="" elementType="Header">
                <stringProp name="Header.name">${escapeXml(h.key)}</stringProp>
                <stringProp name="Header.value">${escapeXml(h.value)}</stringProp>
              </elementProp>`;
        });

        xml += `
            </collectionProp>
          </HeaderManager>
          <hashTree/>`;
      }

      xml += `
        </hashTree>`;
    });

    xml += `
      </hashTree>
    </hashTree>
  </hashTree>
</jmeterTestPlan>`;

    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${collection.name.replace(/\s+/g, '_')}.jmx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
