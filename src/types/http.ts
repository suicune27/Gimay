export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';
export type RequestType = 'rest' | 'graphql' | 'websocket' | 'grpc' | 'socketio';
export type BodyType = 'none' | 'json' | 'form-data' | 'urlencoded' | 'raw' | 'graphql' | 'xml' | 'binary';

export interface FormDataItem {
  id: string;
  key: string;
  value: string;
  type: 'text' | 'file';
  active: boolean;
  description?: string;
  file?: File;
}

export interface RequestBody {
  type: BodyType;
  content: string;
  formData: FormDataItem[];
  urlencoded: KeyValue[];
  graphql: {
    query: string;
    variables: string;
  };
  binary?: {
    file?: File;
    name?: string;
  };
}

export interface KeyValue {
  id: string;
  key: string;
  value: string;
  initialValue?: string;
  currentValue?: string;
  active: boolean;
  enabled?: boolean;
  masked?: boolean;
  description?: string;
  type?: 'string' | 'number' | 'boolean' | 'json' | 'secret' | 'dynamic' | 'encrypted' | 'text' | 'file';
  createdAt?: string;
  updatedAt?: string;
}

export type AuthType = 'none' | 'inherit' | 'bearer' | 'basic' | 'apikey' | 'oauth2';

export interface AuthConfig {
  type: AuthType;
  bearer?: string;
  basic?: { username?: string; password?: string };
  apiKey?: { key: string; value: string; addTo: 'header' | 'query' };
  oauth2?: { accessToken?: string; tokenType?: string };
}

export interface RequestData {
  id: string;
  collection_id?: string;
  folder_id?: string;
  workspace_id: string;
  user_id: string;
  name: string;
  type: RequestType;
  method: HttpMethod;
  url: string;
  headers: KeyValue[];
  params: KeyValue[];
  body: string | RequestBody;
  bodyType: BodyType;
  auth: AuthConfig;
  pre_request_script?: string;
  test_script?: string;
  settings?: {
    followRedirects: boolean;
    timeout: number;
    maxRedirects: number;
    chaosEnabled?: boolean;
    chaosMinDelay?: number;
    chaosMaxDelay?: number;
    chaosFailureRate?: number;
  };
  created_at: string;
  updated_at: string;
}
