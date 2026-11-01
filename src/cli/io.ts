import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { parseProject, serializeProject, type KimballProject } from '../core';

export async function readProject(file: string): Promise<KimballProject> {
  return parseProject(await readFile(file, 'utf8'));
}

/** Writes text atomically (temp file + rename), creating parent folders. */
export async function writeFileAtomic(file: string, text: string): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(tmp, text, 'utf8');
  try {
    await rename(tmp, file);
  } catch (e) {
    // Windows refuses to replace a file another process holds open; fall back to a direct write.
    await rm(tmp, { force: true });
    if ((e as NodeJS.ErrnoException).code === 'EPERM' || (e as NodeJS.ErrnoException).code === 'EBUSY') {
      await writeFile(file, text, 'utf8');
    } else {
      throw e;
    }
  }
}

export async function writeProject(file: string, project: KimballProject): Promise<void> {
  await writeFileAtomic(file, serializeProject(project));
}

export async function mtimeMs(file: string): Promise<number | null> {
  return existsSync(file) ? (await stat(file)).mtimeMs : null;
}
