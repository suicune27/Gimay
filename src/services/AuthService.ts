import { RequestData, AuthConfig, Collection, Folder } from '../types';

export class AuthService {
  static getEffectiveAuth(request: RequestData, collections: Collection[]): AuthConfig {
    if (!request.auth || request.auth.type !== 'inherit') {
      return request.auth || { type: 'none' };
    }

    // Find parent collection
    const collection = collections.find(c => c.id === request.collection_id);
    if (!collection) return { type: 'none' };

    // If request is in a folder
    if (request.folder_id) {
      const folderAuth = this.getFolderAuth(request.folder_id, collection);
      if (folderAuth && folderAuth.type !== 'inherit') {
        return folderAuth;
      }
    }

    // Default to collection auth
    return collection.auth || { type: 'none' };
  }

  private static getFolderAuth(folderId: string, collection: Collection): AuthConfig | null {
    // Find folder recursively or from flat list
    const findFolder = (folders: Folder[], id: string): Folder | undefined => {
      for (const f of folders) {
         if (f.id === id) return f;
      }
      return undefined;
    };

    const targetFolder = findFolder(collection.folders || [], folderId);
    if (!targetFolder) return null;

    if (targetFolder.auth && targetFolder.auth.type !== 'inherit') {
      return targetFolder.auth;
    }

    if (targetFolder.parent_id) {
      return this.getFolderAuth(targetFolder.parent_id, collection);
    }

    return collection.auth;
  }
}
