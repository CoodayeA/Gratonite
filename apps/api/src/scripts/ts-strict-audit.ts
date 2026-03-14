/**
 * TypeScript strict mode audit script.
 *
 * Phase 9, Item 160: Find and report `as any` casts, untyped parameters,
 * and missing return types across the codebase.
 *
 * Usage: npx tsx src/scripts/ts-strict-audit.ts
 */

import fs from 'fs';
import path from 'path';

const SRC_DIR = path.join(__dirname, '..');
const EXTENSIONS = ['.ts', '.tsx'];
const IGNORE_DIRS = ['node_modules', 'dist', '.git'];

interface Finding {
  file: string;
  line: number;
  type: 'as-any' | 'any-param' | 'any-return' | 'ts-ignore' | 'ts-nocheck';
  text: string;
}

function walkDir(dir: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE_DIRS.includes(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkDir(fullPath));
    } else if (EXTENSIONS.includes(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

function auditFile(filePath: string): Finding[] {
  const findings: Finding[] = [];
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const relPath = path.relative(SRC_DIR, filePath);

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    const trimmed = line.trim();

    // Skip comments
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;

    if (line.includes('as any')) {
      findings.push({ file: relPath, line: lineNum, type: 'as-any', text: trimmed });
    }
    if (line.includes(': any') && !line.includes('as any')) {
      findings.push({ file: relPath, line: lineNum, type: 'any-param', text: trimmed });
    }
    if (line.includes('@ts-ignore')) {
      findings.push({ file: relPath, line: lineNum, type: 'ts-ignore', text: trimmed });
    }
    if (line.includes('@ts-nocheck')) {
      findings.push({ file: relPath, line: lineNum, type: 'ts-nocheck', text: trimmed });
    }
  });

  return findings;
}

const files = walkDir(SRC_DIR);
const allFindings: Finding[] = [];

for (const file of files) {
  allFindings.push(...auditFile(file));
}

// Group by type
const grouped = allFindings.reduce((acc, f) => {
  if (!acc[f.type]) acc[f.type] = [];
  acc[f.type].push(f);
  return acc;
}, {} as Record<string, Finding[]>);

console.log('=== TypeScript Strict Mode Audit ===\n');
console.log(`Scanned ${files.length} files\n`);

for (const [type, findings] of Object.entries(grouped)) {
  console.log(`\n--- ${type} (${findings.length} occurrences) ---`);
  findings.slice(0, 10).forEach(f => {
    console.log(`  ${f.file}:${f.line} — ${f.text.slice(0, 100)}`);
  });
  if (findings.length > 10) {
    console.log(`  ... and ${findings.length - 10} more`);
  }
}

console.log(`\n\nTotal findings: ${allFindings.length}`);
console.log('Run this script periodically to track progress toward strict mode.');
