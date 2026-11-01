/** Package version, injected at build time. Falls back for ad-hoc execution. */
export const APP_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0-dev';
