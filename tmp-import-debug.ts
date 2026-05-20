import fs from 'fs';
import { CollectionImportService } from './src/services/CollectionImportService';
import { PersistenceService } from './src/services/PersistenceService';

const json = fs.readFileSync('c:/Users/Gimay/Downloads/EIP Notif API.postman.json', 'utf-8');

const created: any[] = [];
const createdFolders: any[] = [];

const origCreateCollection = PersistenceService.createCollection;
const origUpdateCollection = PersistenceService.updateCollection;
const origCreateFolder = PersistenceService.createFolder;
const origCreateRequest = PersistenceService.createRequest;

(PersistenceService as any).createCollection = async (workspaceId: string, userId: string, name: string) => ({ id: 'col-1', name, workspace_id: workspaceId, user_id: userId });
(PersistenceService as any).updateCollection = async (id: string, updates: any) => ({ id, ...updates });
(PersistenceService as any).createFolder = async (name: string, collectionId: string, userId: string, parentId?: string) => {
  const fake = { id: `folder-${createdFolders.length + 1}`, name, collection_id: collectionId, user_id: userId, parent_id: parentId };
  createdFolders.push(fake);
  return fake;
};
(PersistenceService as any).createRequest = async (data: any) => {
  created.push(data);
  return { id: `req-${created.length}`, ...data };
};

(async () => {
  try {
    const result = await CollectionImportService.importCollection(json, 'workspace-1', 'user-1', 'postman');
    console.log('CREATE REQUESTS:', JSON.stringify(created, null, 2));
    console.log('CREATE FOLDERS:', JSON.stringify(createdFolders, null, 2));
    console.log('RESULT STATS:', result.stats);
  } catch (err) {
    console.error('Import error:', err);
  } finally {
    PersistenceService.createCollection = origCreateCollection;
    PersistenceService.updateCollection = origUpdateCollection;
    PersistenceService.createFolder = origCreateFolder;
    PersistenceService.createRequest = origCreateRequest;
  }
})();
