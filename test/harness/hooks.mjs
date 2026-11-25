import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
const here = path.dirname(fileURLToPath(import.meta.url));
export async function resolve(spec, ctx, next) {
  if (spec === 'three') return { url: pathToFileURL(path.join(here, 'three-stub.mjs')).href, shortCircuit: true };
  return next(spec, ctx);
}
export async function load(url, ctx, next) {
  const r = await next(url, ctx);
  if (url.endsWith('.js') && r.source) return { ...r, source: r.source.toString().replaceAll('import.meta.env.BASE_URL', "'/'") };
  return r;
}
