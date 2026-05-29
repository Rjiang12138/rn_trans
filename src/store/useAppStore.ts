import {create} from 'zustand';
import RNFS from 'react-native-fs';
import {Image} from 'react-native';
import type {Project, PageData} from '../types';
import {
  loadProjects,
  saveProjects,
  ensureProjectDir,
  getProjectDir,
} from '../storage/storage';
import {makeId} from '../utils/id';

const normalizeFilePath = (uri: string) => uri.replace('file://', '');
const MAX_PAGES_PER_PROJECT = 50;

type AppState = {
  projects: Project[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  createProject: (name: string) => Promise<string | null>;
  deleteProject: (id: string) => Promise<void>;
  importPages: (
    projectId: string,
    sourceUris: string[],
  ) => Promise<{added: number; blocked: boolean}>;
  updatePage: (projectId: string, page: PageData) => Promise<void>;
};

export const useAppStore = create<AppState>((set, get) => ({
  projects: [],
  hydrated: false,
  hydrate: async () => {
    const projects = await loadProjects();
    set({projects, hydrated: true});
  },
  createProject: async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      return null;
    }
    const id = makeId();
    const now = Date.now();
    const project: Project = {
      id,
      name: trimmed,
      createdAt: now,
      updatedAt: now,
      pages: [],
    };
    await ensureProjectDir(id);
    const projects = [project, ...get().projects];
    set({projects});
    await saveProjects(projects);
    return id;
  },
  deleteProject: async (id: string) => {
    const projects = get().projects.filter(item => item.id !== id);
    set({projects});
    await saveProjects(projects);
    const folder = getProjectDir(id);
    if (await RNFS.exists(folder)) {
      await RNFS.unlink(folder);
    }
  },
  importPages: async (projectId: string, sourceUris: string[]) => {
    const project = get().projects.find(item => item.id === projectId);
    if (!project) {
      return {added: 0, blocked: false};
    }

    const left = MAX_PAGES_PER_PROJECT - project.pages.length;
    const limited = sourceUris.slice(0, Math.max(0, left));
    const blocked = sourceUris.length > limited.length;

    await ensureProjectDir(projectId);
    const pageDir = `${getProjectDir(projectId)}/pages`;
    const newPages: PageData[] = [];

    for (let i = 0; i < limited.length; i += 1) {
      const source = limited[i];
      const fromPath = normalizeFilePath(source);
      const ext = (fromPath.split('.').pop() || 'jpg').toLowerCase();
      const pageId = makeId();
      const target = `${pageDir}/${pageId}.${ext}`;
      await RNFS.copyFile(fromPath, target);

      const size = await new Promise<{width: number; height: number}>(
        (resolve, reject) => {
          Image.getSize(
            `file://${target}`,
            (width: number, height: number) => resolve({width, height}),
            (error: unknown) => reject(error),
          );
        },
      );

      newPages.push({
        id: pageId,
        imagePath: target,
        width: size.width,
        height: size.height,
        strokes: [],
        texts: [],
        updatedAt: Date.now(),
      });
    }

    const projects = get().projects.map(item =>
      item.id === projectId
        ? {
            ...item,
            pages: [...item.pages, ...newPages],
            updatedAt: Date.now(),
          }
        : item,
    );

    set({projects});
    await saveProjects(projects);
    return {added: newPages.length, blocked};
  },
  updatePage: async (projectId: string, page: PageData) => {
    const projects = get().projects.map(project => {
      if (project.id !== projectId) {
        return project;
      }
      return {
        ...project,
        updatedAt: Date.now(),
        pages: project.pages.map(item =>
          item.id === page.id ? {...page, updatedAt: Date.now()} : item,
        ),
      };
    });
    set({projects});
    await saveProjects(projects);
  },
}));
