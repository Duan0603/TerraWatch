// Node ESM hooks for tests only. Source under src/ is untouched; this lets plain Node load API modules by:
//  - resolving extensionless relative imports ('./axiosClient') the way Vite does,
//  - replacing the modules that need Vite's import.meta.env / a real browser (axiosClient, config/firebase, firebase/auth)
//    with recording stubs that delegate to globalThis.__tw (set by each test).
const STUBS = {
  axiosClient: `
    const call = (method) => (url, ...rest) => globalThis.__tw.http(method, url, ...rest);
    export const axiosClient = { get: call('get'), post: call('post'), patch: call('patch'), delete: call('delete') };
    export const API_BASE_URL = 'http://stub';
    export default axiosClient;`,
  'config-firebase': `
    export let auth = null;
    export const firebaseConfigured = false;
    export function __setAuth(v) { auth = v; }
    export default auth;`,
  'firebase-auth': `
    export class RecaptchaVerifier { constructor(...args) { return globalThis.__tw.makeVerifier(...args); } }
    export const signInWithPhoneNumber = (...args) => globalThis.__tw.signInWithPhoneNumber(...args);`
};

export async function resolve(specifier, context, nextResolve) {
  if (/^tw-stub:/.test(specifier)) return { url: specifier, shortCircuit: true };
  if (/\/axiosClient$/.test(specifier)) return { url: 'tw-stub:axiosClient', shortCircuit: true };
  if (/\/config\/firebase$/.test(specifier)) return { url: 'tw-stub:config-firebase', shortCircuit: true };
  if (specifier === 'firebase/auth') return { url: 'tw-stub:firebase-auth', shortCircuit: true };
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (err.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.') && !/\.\w+$/.test(specifier)) {
      return nextResolve(`${specifier}.js`, context);
    }
    throw err;
  }
}

export async function load(url, context, nextLoad) {
  if (url.startsWith('tw-stub:')) {
    return { format: 'module', source: STUBS[url.slice('tw-stub:'.length)], shortCircuit: true };
  }
  return nextLoad(url, context);
}
