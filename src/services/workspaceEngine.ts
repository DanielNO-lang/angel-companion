import { storageService, STORAGE_KEYS } from './storageService';
import { companionData } from './companionData';

export type WorkspaceFileType = 'document' | 'code' | 'note' | 'research' | 'generated_content';

export interface WorkspaceFile {
  id: string;
  projectId: string;
  name: string;
  type: WorkspaceFileType;
  content: string;
  sizeBytes: number;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
}

export interface WorkspaceProject {
  id: string;
  name: string;
  description: string;
  studioId?: import('../types/angel').StudioId;
  createdAt: string;
  updatedAt: string;
  files: WorkspaceFile[];
}

const STARTER_PROJECT_ID = 'proj_default';
const STARTER_FILE_IDS = new Set(['file_1', 'file_2']);

const DEFAULT_PROJECTS: WorkspaceProject[] = [
  {
    id: STARTER_PROJECT_ID,
    name: 'Angel Foundation System',
    description: 'Core application system architecture and knowledge base',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    files: [
      {
        id: 'file_1',
        projectId: STARTER_PROJECT_ID,
        name: 'Angel System Architecture.md',
        type: 'document',
        content: '# Angel AI System Architecture\n\nUnified personal AI companion and intelligent work environment featuring 3D Three.js rendering, multi-layer motion canvas, and 8 specialized Studio environments.',
        sizeBytes: 1024,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: ['architecture', 'docs'],
      },
      {
        id: 'file_2',
        projectId: STARTER_PROJECT_ID,
        name: 'Supabase Migration Schema.sql',
        type: 'code',
        content: '-- PostgreSQL Migration Blueprint\nCREATE TABLE profiles (id UUID PRIMARY KEY, full_name TEXT);\nALTER TABLE profiles ENABLE ROW LEVEL SECURITY;',
        sizeBytes: 512,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: ['sql', 'schema'],
      },
    ],
  },
];

function isUntouchedStarter(project: WorkspaceProject): boolean {
  return (
    project.id === STARTER_PROJECT_ID &&
    project.name === 'Angel Foundation System' &&
    project.files.every((f) => STARTER_FILE_IDS.has(f.id))
  );
}

export class WorkspaceEngine {
  private projects: WorkspaceProject[] = [];
  private accessToken: string | null = null;
  private activeUserId: string | null = null;
  private cloudHydrationToken: string | null = null;

  constructor() {
    this.loadCurrentScope();
  }

  private scopedKey(base: string): string {
    return this.activeUserId ? `${base}:user:${this.activeUserId}` : base;
  }

  private loadCurrentScope(): void {
    const defaultProjects = this.activeUserId
      ? [
          {
            id: STARTER_PROJECT_ID,
            name: 'General Workspace',
            description: 'Your private project files and instructions',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            files: [],
          },
        ]
      : DEFAULT_PROJECTS;

    const loaded = storageService.load<WorkspaceProject[]>(
      this.scopedKey(STORAGE_KEYS.workspaceProjects),
      defaultProjects
    );
    this.projects = Array.isArray(loaded) && loaded.length > 0 ? loaded : defaultProjects;
  }

  public setAuthContext(token: string | null, userId?: string | null): void {
    const nextUserId = token ? userId || null : null;
    const identityChanged = this.activeUserId !== nextUserId;
    this.accessToken = token;

    if (identityChanged) {
      this.activeUserId = nextUserId;
      this.cloudHydrationToken = null;
      this.loadCurrentScope();
    }

    if (!token) {
      this.cloudHydrationToken = null;
      return;
    }

    if ((this.cloudHydrationToken !== token || identityChanged) && companionData.isCloudConfigured()) {
      this.cloudHydrationToken = token;
      void this.restoreCloud(token);
    }
  }

  private async restoreCloud(token: string): Promise<void> {
    const ownerId = this.activeUserId;
    if (!ownerId || !companionData.isCloudConfigured()) return;
    try {
      const cloudProjects = await companionData.loadWorkspaceProjects(token);
      if (this.accessToken !== token || this.activeUserId !== ownerId) return;

      const byId = new Map<string, WorkspaceProject>();
      cloudProjects.forEach((p) => byId.set(p.id, p));
      this.projects.forEach((local) => {
        if (isUntouchedStarter(local) && cloudProjects.length > 0) return;
        const existing = byId.get(local.id);
        if (!existing || local.updatedAt > existing.updatedAt) {
          byId.set(local.id, local);
        }
      });

      const merged = Array.from(byId.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      if (merged.length > 0) {
        this.projects = merged;
        this.persist(false);
      }
    } catch (error) {
      companionData.reportEngineSyncError('companion_projects', error);
    }
  }

  private persist(syncToCloud = true): void {
    storageService.save(this.scopedKey(STORAGE_KEYS.workspaceProjects), this.projects);
    if (syncToCloud && this.accessToken && this.activeUserId && companionData.isCloudConfigured()) {
      const toSync = this.projects.filter((p) => !isUntouchedStarter(p));
      if (toSync.length > 0) {
        void companionData.syncWorkspaceProjects(this.accessToken, toSync, this.activeUserId).catch((error) => {
          companionData.reportEngineSyncError('companion_projects', error);
        });
      }
    }
  }

  cleanupSampleRecords(): number {
    const before = this.projects.length;
    this.projects = this.projects.filter((p) => !isUntouchedStarter(p));
    const removed = before - this.projects.length;
    if (removed > 0) {
      this.persist(false);
    }
    return removed;
  }

  getProjects(): WorkspaceProject[] {
    return this.projects;
  }

  createProject(name: string, description: string): WorkspaceProject {
    const newProj: WorkspaceProject = {
      id: `proj_${Date.now()}`,
      name,
      description,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      files: [],
    };

    this.projects.unshift(newProj);
    this.persist();
    return newProj;
  }

  addFileToProject(
    projectId: string,
    name: string,
    content: string,
    type: WorkspaceFileType = 'document',
    tags?: string[]
  ): WorkspaceFile | null {
    const proj = this.projects.find((p) => p.id === projectId) || this.projects[0];
    if (!proj) return null;

    const newFile: WorkspaceFile = {
      id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      projectId: proj.id,
      name,
      type,
      content,
      sizeBytes: new Blob([content]).size,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags,
    };

    proj.files.unshift(newFile);
    proj.updatedAt = new Date().toISOString();
    this.persist();
    return newFile;
  }

  updateFileContent(fileId: string, newContent: string): boolean {
    for (const proj of this.projects) {
      const file = proj.files.find((f) => f.id === fileId);
      if (file) {
        file.content = newContent;
        file.sizeBytes = new Blob([newContent]).size;
        file.updatedAt = new Date().toISOString();
        proj.updatedAt = new Date().toISOString();
        this.persist();
        return true;
      }
    }
    return false;
  }

  deleteFile(fileId: string): boolean {
    for (const proj of this.projects) {
      const initialLen = proj.files.length;
      proj.files = proj.files.filter((f) => f.id !== fileId);
      if (proj.files.length < initialLen) {
        proj.updatedAt = new Date().toISOString();
        this.persist();
        return true;
      }
    }
    return false;
  }

  searchFiles(query: string): WorkspaceFile[] {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    const results: WorkspaceFile[] = [];

    this.projects.forEach((proj) => {
      proj.files.forEach((file) => {
        if (
          file.name.toLowerCase().includes(q) ||
          file.content.toLowerCase().includes(q) ||
          file.tags?.some((t) => t.toLowerCase().includes(q))
        ) {
          results.push(file);
        }
      });
    });

    return results;
  }

  renameProject(projectId: string, newName: string, newDescription?: string): boolean {
    const proj = this.projects.find((p) => p.id === projectId);
    if (proj && newName.trim()) {
      proj.name = newName.trim();
      if (newDescription !== undefined) proj.description = newDescription.trim();
      proj.updatedAt = new Date().toISOString();
      this.persist();
      return true;
    }
    return false;
  }

  renameFile(fileId: string, newName: string): boolean {
    for (const proj of this.projects) {
      const file = proj.files.find((f) => f.id === fileId);
      if (file && newName.trim()) {
        file.name = newName.trim();
        file.updatedAt = new Date().toISOString();
        proj.updatedAt = new Date().toISOString();
        this.persist();
        return true;
      }
    }
    return false;
  }

  associateStudioWithProject(projectId: string, studioId?: import('../types/angel').StudioId): boolean {
    const proj = this.projects.find((p) => p.id === projectId);
    if (proj) {
      proj.studioId = studioId;
      proj.updatedAt = new Date().toISOString();
      this.persist();
      return true;
    }
    return false;
  }

  deleteProject(projectId: string): boolean {
    const initialLen = this.projects.length;
    this.projects = this.projects.filter((p) => p.id !== projectId);
    if (this.projects.length < initialLen) {
      this.persist(false);
      if (this.accessToken && companionData.isCloudConfigured()) {
        void companionData.deleteWorkspaceProject(this.accessToken, projectId).catch((error) => {
          companionData.reportEngineSyncError('companion_projects', error);
        });
      }
      return true;
    }
    return false;
  }

  addInstructionToProject(projectId: string, instructionText: string): WorkspaceFile | null {
    const proj = this.projects.find((p) => p.id === projectId) || this.projects[0];
    if (!proj) return null;

    const fileName = `Instruction_${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).replace(/\s/g, '_')}.md`;
    return this.addFileToProject(
      proj.id,
      fileName,
      `# Project Instruction\n\n**Submitted:** ${new Date().toLocaleString()}\n\n${instructionText}`,
      'note',
      ['instruction']
    );
  }
}

export const workspaceEngine = new WorkspaceEngine();
