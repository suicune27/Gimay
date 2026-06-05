// Re-exports from domain-specific persistence modules
export { registerPersistenceStore } from './persistence/CorePersistence';
export { registerPersistenceStore as registerStore } from './persistence/CorePersistence';
export {
  createWorkspace, createWorkspaceOnline, updateWorkspace, updateWorkspaceOnline,
  deleteWorkspace, deleteWorkspaceOnline
} from './persistence/WorkspacePersistence';
export {
  createCollection, createCollectionOnline, updateCollection, updateCollectionOnline,
  deleteCollection, deleteCollectionOnline, duplicateCollection
} from './persistence/CollectionPersistence';
export {
  createFolder, createFolderOnline, updateFolder, updateFolderOnline,
  deleteFolder, deleteFolderOnline, duplicateFolder
} from './persistence/FolderPersistence';
export {
  createRequest, createRequestOnline, saveRequest, saveRequestOnline,
  deleteRequest, deleteRequestOnline, duplicateRequest
} from './persistence/RequestPersistence';
export {
  createEnvironment, createEnvironmentOnline, updateEnvironment, updateEnvironmentOnline,
  deleteEnvironment, deleteEnvironmentOnline
} from './persistence/EnvironmentPersistence';
export {
  createTeam, createTeamOnline, addTeamMember, updateTeamMemberRole, removeTeamMember,
  fetchUserTeams, fetchWorkspacesByTeam
} from './persistence/TeamPersistence';
export { saveHistory, deleteHistory, clearHistory } from './persistence/HistoryPersistence';
export { updateProfilePreferences, updateProfileOnline } from './persistence/ProfilePersistence';
export { createSavedResponse, getSavedResponses, deleteSavedResponse } from './persistence/SavedResponsePersistence';
export { inviteCollectionCollaborator, updateCollectionCollaboratorRole, removeCollectionCollaborator } from './persistence/CollaboratorPersistence';
export { syncUserTabs, getUserTabs } from './persistence/TabPersistence';
export { saveGlobalVariables, getGlobalVariables } from './persistence/GlobalVariablePersistence';
export { createScriptLog, fetchScripts, fetchScriptFolders, createScript, updateScript, deleteScript } from './persistence/ScriptPersistence';

// Local imports for backward-compatible class
import { registerPersistenceStore as _registerPersistenceStore } from './persistence/CorePersistence';
import {
  createWorkspace as _createWorkspace, createWorkspaceOnline as _createWorkspaceOnline,
  updateWorkspace as _updateWorkspace, updateWorkspaceOnline as _updateWorkspaceOnline,
  deleteWorkspace as _deleteWorkspace, deleteWorkspaceOnline as _deleteWorkspaceOnline
} from './persistence/WorkspacePersistence';
import {
  createCollection as _createCollection, createCollectionOnline as _createCollectionOnline,
  updateCollection as _updateCollection, updateCollectionOnline as _updateCollectionOnline,
  deleteCollection as _deleteCollection, deleteCollectionOnline as _deleteCollectionOnline,
  duplicateCollection as _duplicateCollection
} from './persistence/CollectionPersistence';
import {
  createFolder as _createFolder, createFolderOnline as _createFolderOnline,
  updateFolder as _updateFolder, updateFolderOnline as _updateFolderOnline,
  deleteFolder as _deleteFolder, deleteFolderOnline as _deleteFolderOnline,
  duplicateFolder as _duplicateFolder
} from './persistence/FolderPersistence';
import {
  createRequest as _createRequest, createRequestOnline as _createRequestOnline,
  saveRequest as _saveRequest, saveRequestOnline as _saveRequestOnline,
  deleteRequest as _deleteRequest, deleteRequestOnline as _deleteRequestOnline,
  duplicateRequest as _duplicateRequest
} from './persistence/RequestPersistence';
import {
  createEnvironment as _createEnvironment, createEnvironmentOnline as _createEnvironmentOnline,
  updateEnvironment as _updateEnvironment, updateEnvironmentOnline as _updateEnvironmentOnline,
  deleteEnvironment as _deleteEnvironment, deleteEnvironmentOnline as _deleteEnvironmentOnline
} from './persistence/EnvironmentPersistence';
import {
  createTeam as _createTeam, createTeamOnline as _createTeamOnline,
  addTeamMember as _addTeamMember, updateTeamMemberRole as _updateTeamMemberRole,
  removeTeamMember as _removeTeamMember, fetchUserTeams as _fetchUserTeams,
  fetchWorkspacesByTeam as _fetchWorkspacesByTeam
} from './persistence/TeamPersistence';
import { saveHistory as _saveHistory, deleteHistory as _deleteHistory, clearHistory as _clearHistory } from './persistence/HistoryPersistence';
import { updateProfilePreferences as _updateProfilePreferences, updateProfileOnline as _updateProfileOnline } from './persistence/ProfilePersistence';
import { createSavedResponse as _createSavedResponse, getSavedResponses as _getSavedResponses, deleteSavedResponse as _deleteSavedResponse } from './persistence/SavedResponsePersistence';
import { inviteCollectionCollaborator as _inviteCC, updateCollectionCollaboratorRole as _updateCCR, removeCollectionCollaborator as _removeCC } from './persistence/CollaboratorPersistence';
import { syncUserTabs as _syncUserTabs, getUserTabs as _getUserTabs } from './persistence/TabPersistence';
import { saveGlobalVariables as _saveGV, getGlobalVariables as _getGV } from './persistence/GlobalVariablePersistence';
import { createScriptLog as _createScriptLog, fetchScripts as _fetchScripts, fetchScriptFolders as _fetchScriptFolders, createScript as _createScript, updateScript as _updateScript, deleteScript as _deleteScript } from './persistence/ScriptPersistence';

// Backward-compatible static class
export class PersistenceService {
  static registerStore = _registerPersistenceStore;

  static createWorkspace = _createWorkspace;
  static createWorkspaceOnline = _createWorkspaceOnline;
  static updateWorkspace = _updateWorkspace;
  static updateWorkspaceOnline = _updateWorkspaceOnline;
  static deleteWorkspace = _deleteWorkspace;
  static deleteWorkspaceOnline = _deleteWorkspaceOnline;

  static createCollection = _createCollection;
  static createCollectionOnline = _createCollectionOnline;
  static updateCollection = _updateCollection;
  static updateCollectionOnline = _updateCollectionOnline;
  static deleteCollection = _deleteCollection;
  static deleteCollectionOnline = _deleteCollectionOnline;
  static duplicateCollection = _duplicateCollection;

  static createFolder = _createFolder;
  static createFolderOnline = _createFolderOnline;
  static updateFolder = _updateFolder;
  static updateFolderOnline = _updateFolderOnline;
  static deleteFolder = _deleteFolder;
  static deleteFolderOnline = _deleteFolderOnline;
  static duplicateFolder = _duplicateFolder;

  static createRequest = _createRequest;
  static createRequestOnline = _createRequestOnline;
  static saveRequest = _saveRequest;
  static updateRequest = _saveRequest;
  static saveRequestOnline = _saveRequestOnline;
  static deleteRequest = _deleteRequest;
  static deleteRequestOnline = _deleteRequestOnline;
  static duplicateRequest = _duplicateRequest;

  static createEnvironment = _createEnvironment;
  static createEnvironmentOnline = _createEnvironmentOnline;
  static updateEnvironment = _updateEnvironment;
  static updateEnvironmentOnline = _updateEnvironmentOnline;
  static deleteEnvironment = _deleteEnvironment;
  static deleteEnvironmentOnline = _deleteEnvironmentOnline;

  static createTeam = _createTeam;
  static createTeamOnline = _createTeamOnline;
  static addTeamMember = _addTeamMember;
  static updateTeamMemberRole = _updateTeamMemberRole;
  static removeTeamMember = _removeTeamMember;
  static fetchUserTeams = _fetchUserTeams;
  static fetchWorkspacesByTeam = _fetchWorkspacesByTeam;

  static saveHistory = _saveHistory;
  static deleteHistory = _deleteHistory;
  static clearHistory = _clearHistory;

  static updateProfilePreferences = _updateProfilePreferences;
  static updateProfileOnline = _updateProfileOnline;

  static createSavedResponse = _createSavedResponse;
  static getSavedResponses = _getSavedResponses;
  static deleteSavedResponse = _deleteSavedResponse;

  static inviteCollectionCollaborator = _inviteCC;
  static updateCollectionCollaboratorRole = _updateCCR;
  static removeCollectionCollaborator = _removeCC;

  static syncUserTabs = _syncUserTabs;
  static getUserTabs = _getUserTabs;

  static saveGlobalVariables = _saveGV;
  static getGlobalVariables = _getGV;

  static createScriptLog = _createScriptLog;
  static fetchScripts = _fetchScripts;
  static fetchScriptFolders = _fetchScriptFolders;
  static createScript = _createScript;
  static updateScript = _updateScript;
  static deleteScript = _deleteScript;
}

export default PersistenceService;
