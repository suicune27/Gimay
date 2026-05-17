import { RequestData } from '../types';

export class ExportUtils {
  static toCurl(request: RequestData): string {
    let curl = `curl --location --request ${request.method} '${request.url}'`;

    // Headers
    (request.headers || []).forEach(header => {
      if (header.active && header.key && header.value) {
        curl += ` \\\n--header '${header.key}: ${header.value}'`;
      }
    });

    // Body
    if (request.body && request.method !== 'GET') {
      if (request.bodyType === 'json') {
        curl += ` \\\n--header 'Content-Type: application/json'`;
        curl += ` \\\n--data-raw '${request.body}'`;
      } else {
        curl += ` \\\n--data-raw '${request.body}'`;
      }
    }

    return curl;
  }

  static toFetch(request: RequestData): string {
    const headers: Record<string, string> = {};
    (request.headers || []).forEach(h => {
      if (h.active && h.key) headers[h.key] = h.value;
    });

    if (request.bodyType === 'json' && request.method !== 'GET') {
      headers['Content-Type'] = 'application/json';
    }

    const options: any = {
      method: request.method,
      headers
    };

    if (request.body && request.method !== 'GET') {
      options.body = request.body;
    }

    return `fetch("${request.url}", ${JSON.stringify(options, null, 2)});`;
  }

  static downloadJson(data: any, filename: string) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    try {
      if (document.body) {
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        console.error('Document body not available for download');
      }
    } catch (error) {
      console.error('Error during JSON download:', error);
    }
    URL.revokeObjectURL(url);
  }
}
