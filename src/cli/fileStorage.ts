import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { SaveStorage } from '../game/save';

export function fileStorage(path: string): SaveStorage {
  return {
    read() {
      return existsSync(path) ? readFileSync(path, 'utf8') : null;
    },
    write(data) {
      mkdirSync(dirname(path), { recursive: true });
      // Write to a temp file first so a crash mid-write can't corrupt the save.
      const tmp = `${path}.tmp`;
      writeFileSync(tmp, data);
      renameSync(tmp, path);
    },
    clear() {
      rmSync(path, { force: true });
    },
  };
}
