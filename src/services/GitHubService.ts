import axios from 'axios';
import { Collection, RequestData, Folder } from '../types';
import { useStore } from '../store/useStore';
import { PersistenceService } from './PersistenceService';
import { CollectionImportService } from './CollectionImportService';

export class GitHubService {
  private static get config() {
    return useStore.getState().settings.github;
  }

  private static get headers() {
    return {
      Authorization: `token ${this.config.token}`,
      Accept: 'application/vnd.github.v3+json',
    };
  }

  static async pullUpdates(workspaceId: string, userId: string) {
    const { repo, branch, path } = this.config;
    if (!repo || !this.config.token) {
      throw new Error('GitHub configuration incomplete (Token and Repo required)');
    }

    try {
      // Get the contents of the path
      const url = `https://api.github.com/repos/${repo}/contents/${path}?ref=${branch}`;
      const response = await axios.get(url, { headers: this.headers });

      if (!Array.isArray(response.data)) {
        throw new Error('Specified path is not a directory or is empty.');
      }

      const files = response.data.filter((f: any) => f.type === 'file' && f.name.endsWith('.json'));
      let importedCount = 0;

      for (const file of files) {
        const fileRes = await axios.get(file.download_url);
        const raw = JSON.stringify(fileRes.data);
        
        try {
          await CollectionImportService.importCollection(raw, workspaceId, userId, 'auto');
          importedCount++;
        } catch (err) {
          console.error(`Failed to import ${file.name}:`, err);
        }
      }

      useStore.getState().updateSettings({
        github: { ...this.config, lastPulledAt: new Date().toISOString() }
      });

      return importedCount;
    } catch (error: any) {
      console.error('GitHub Pull Error:', error);
      throw new Error(error.response?.data?.message || error.message || 'Failed to pull from GitHub');
    }
  }

  static async pushUpdates(collection: Collection) {
    const { repo, branch, path: configPath } = this.config;
    if (!repo || !this.config.token) {
       throw new Error('GitHub configuration incomplete');
    }

    try {
      const fileName = `${collection.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
      const fullPath = configPath ? `${configPath}/${fileName}` : fileName;
      
      // We need to fetch all details for the collection (requests and folders)
      // Since collection.requests might be partial, we should ideally fetch from DB
      // But for now, we'll assume the passed collection is the one we want to sync.
      
      const payload = JSON.stringify(collection, null, 2);
      const url = `https://api.github.com/repos/${repo}/contents/${fullPath}`;

      // Check if file exists to get SHA
      let sha: string | undefined;
      try {
        const getRes = await axios.get(`${url}?ref=${branch}`, { headers: this.headers });
        sha = getRes.data.sha;
      } catch (e) {
        // File doesn't exist, which is fine for first push
      }

      await axios.put(url, {
        message: `Sync collection: ${collection.name}`,
        content: btoa(unescape(encodeURIComponent(payload))),
        branch,
        sha
      }, { headers: this.headers });

      useStore.getState().updateSettings({
        github: { ...this.config, lastPushedAt: new Date().toISOString() }
      });

      return true;
    } catch (error: any) {
      console.error('GitHub Push Error:', error);
      throw new Error(error.response?.data?.message || error.message || 'Failed to push to GitHub');
    }
  }
}
