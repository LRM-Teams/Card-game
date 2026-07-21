import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../../../docs/assets/fx-demos');
fs.mkdirSync(outDir, { recursive: true });
const files = fs.readdirSync(outDir).filter((f) => f.endsWith('.webm'));
console.log('webm files:', files);
