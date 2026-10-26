// Wolfe telemetry standard v1: the shared loader tag in public/index.html
// handles pageviews, vitals, errors and the actor/env tags. This module only
// forwards the app's core custom events to it. Properties are enumerated values
// only (never usernames, queries or other user content).

type EventProperties = Record<string, boolean | number | string>;

interface WolfeTelemetry {
  capture: (event: string, properties?: EventProperties) => void;
}

function isWolfeTelemetry(value: unknown): value is WolfeTelemetry {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof Reflect.get(value, 'capture') === 'function'
  );
}

export function capture(event: string, properties?: EventProperties): void {
  const telemetry: unknown = Reflect.get(globalThis, 'wolfeTelemetry');
  if (isWolfeTelemetry(telemetry)) {
    telemetry.capture(event, properties);
  }
}

export type SearchMode =
  | 'aggregate'
  | 'compare'
  | 'contributor'
  | 'multi_repo'
  | 'org'
  | 'repo'
  | 'user';

// Classify the input format without ever sending its content.
export function searchMode(input: string): SearchMode {
  const value = input.trim();
  if (value.includes('?') || value.includes('~')) {
    return 'compare';
  }
  if (value.startsWith('@') || value.startsWith('org:')) {
    return 'org';
  }
  if (/\s|\+/u.test(value)) {
    return 'aggregate';
  }
  if (value.includes('/')) {
    const [, repos = ''] = value.split('/');
    if (repos.includes('@')) {
      return 'contributor';
    }
    return repos.includes(',') ? 'multi_repo' : 'repo';
  }
  return 'user';
}
