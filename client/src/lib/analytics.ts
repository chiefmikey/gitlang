import posthogJs from 'posthog-js';

type PostHog = typeof posthogJs;
type Properties = NonNullable<Parameters<PostHog['capture']>[1]>;
type CaptureOptions = Parameters<PostHog['capture']>[2];

// Kill switch. Analytics intake is the public PostHog endpoint below (cookieless,
// memory persistence). Set false to make init and capture no-ops (no SDK load,
// no network requests). Never set ui_host: it would expose the private dashboard.
const ANALYTICS_ENABLED = true as boolean;

// Public intake endpoint + publishable project key (safe to commit).
const POSTHOG_HOST = 'https://e.wolfe.works';
const POSTHOG_KEY = 'phc_qwmTbmBYEBvZfpK8L8wZNmMsknSu2itJDpQjJ5FfndE4';

let posthogInstance: PostHog | undefined;

export function initAnalytics(): PostHog {
  if (ANALYTICS_ENABLED) {
    posthogJs.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      autocapture: false,
      capture_pageview: false,
      disable_session_recording: true,
      persistence: 'memory',
      person_profiles: 'identified_only',
    });
  }
  posthogInstance = posthogJs;
  return posthogJs;
}

function getInstance(): PostHog {
  return posthogInstance ?? initAnalytics();
}

export function capture(
  event: string,
  properties?: Properties,
  options?: CaptureOptions,
): void {
  if (!ANALYTICS_ENABLED) {
    return;
  }
  getInstance().capture(event, properties, options);
}

export function capturePageView(properties?: Properties): void {
  if (!ANALYTICS_ENABLED) {
    return;
  }
  getInstance().capture('$pageview', properties);
}
