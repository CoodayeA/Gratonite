/**
 * Resolves refs and parses docs/api/openapi.yaml (hand-maintained sketch; not all paths are spec-complete).
 * Run: pnpm --filter gratonite-api run validate:openapi
 */
import SwaggerParser from '@apidevtools/swagger-parser';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const specPath = path.resolve(__dirname, '../../../docs/api/openapi.yaml');

await SwaggerParser.bundle(specPath);
console.log('OpenAPI bundle OK:', specPath);
