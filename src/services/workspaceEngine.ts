import { storageService, STORAGE_KEYS } from './storageService';

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
  createdAt: string;
  updatedAt: string;
  files: WorkspaceFile[];
}

const DEFAULT_PROJECTS: WorkspaceProject[] = [
  {
    id: 'proj_default',
    name: 'Angel Foundation System',
    description: 'Core application system architecture and knowledge base',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    files: [
      {
        id: 'file_1',
        projectId: 'proj_default',
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
        projectId: 'proj_default',
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

export class WorkspaceEngine {
  private projects: WorkspaceProject[];

  constructor() {
    this.projects = storageService.load<WorkspaceProject[]>(
      STORAGE_KEYS.workspaceProjects,
      DEFAULT_PROJECTS
    );
  }

  private persist() {
    storageService.save(STORAGE_KEYS.workspaceProjects, this.projects);
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
      id: `file_${Date.now()}`,
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
