import RNFS from 'react-native-fs';
import type {Project} from '../types';

const ROOT_DIR = `${RNFS.DocumentDirectoryPath}/comic_translator`;
const PROJECT_FILE = `${ROOT_DIR}/projects.json`;

const ensureRoot = async () => {
  const exists = await RNFS.exists(ROOT_DIR);
  if (!exists) {
    await RNFS.mkdir(ROOT_DIR);
  }
};

export const getRootDir = () => ROOT_DIR;

export const getProjectDir = (projectId: string) => `${ROOT_DIR}/projects/${projectId}`;

export const ensureProjectDir = async (projectId: string) => {
  await ensureRoot();
  const base = getProjectDir(projectId);
  const pages = `${base}/pages`;
  if (!(await RNFS.exists(base))) {
    await RNFS.mkdir(base);
  }
  if (!(await RNFS.exists(pages))) {
    await RNFS.mkdir(pages);
  }
};

export const loadProjects = async (): Promise<Project[]> => {
  await ensureRoot();
  const exists = await RNFS.exists(PROJECT_FILE);
  if (!exists) {
    return [];
  }
  const content = await RNFS.readFile(PROJECT_FILE, 'utf8');
  try {
    return JSON.parse(content) as Project[];
  } catch {
    return [];
  }
};

export const saveProjects = async (projects: Project[]) => {
  await ensureRoot();
  await RNFS.writeFile(PROJECT_FILE, JSON.stringify(projects), 'utf8');
};
