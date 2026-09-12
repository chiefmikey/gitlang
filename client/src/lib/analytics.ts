import posthogJs from 'posthog-js';

type PostHog = typeof posthogJs;
type Properties = NonNullable<Parameters<PostHog['capture']>[1]>;
type CaptureOptions = Parameters<PostHog['capture']>[2];

const POSTHOG_HOST = 'https://analytics.wolfe.family';
const POSTHOG_KEY = 'phc_qwmTbmBYEBvZfpK8L8wZNmMsknSu2itJDpQjJ5FfndE4';

let posthogInstance: PostHog | undefined;

export function initAnalytics(): PostHog {
  posthogJs.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    autocapture: false,
    capture_pageview: false,
    disable_session_recording: true,
    persistence: 'memory',
    person_profiles: 'identified_only',
  });
  posthogInstance = posthogJs;
  return posthogJs;
}

function getInstance(): PostHog {
  return posthogInstance ?? initAnalytics();
}

export function capture(event: string, properties?: Properties, options?: CaptureOptions): void {
  getInstance().capture(event, properties, options);
}

export function capturePageView(properties?: Properties): void {
  getInstance().capture('$pageview', properties);
}
