import { cpSync, mkdirSync } from 'node:fs';
mkdirSync('public/fonts', { recursive: true });
cpSync('node_modules/mathlive/fonts', 'public/fonts', { recursive: true });
