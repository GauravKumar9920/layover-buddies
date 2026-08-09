import type { SVGProps } from 'react';

export type IconName =
  | 'overview' | 'inbox' | 'booking' | 'live' | 'dispute' | 'traveler' | 'buddy'
  | 'route' | 'review' | 'sos' | 'report' | 'shield' | 'delete' | 'money' | 'refund'
  | 'payout' | 'pricing' | 'growth' | 'content' | 'notification' | 'jobs' | 'audit'
  | 'team' | 'settings' | 'search' | 'menu' | 'close' | 'refresh' | 'arrow'
  | 'warning' | 'check' | 'clock' | 'external' | 'chevron' | 'filter';

const paths: Record<IconName, JSX.Element> = {
  overview: <><path d="M4 13h6V4H4v9Zm0 7h6v-4H4v4Zm10 0h6v-9h-6v9Zm0-16v4h6V4h-6Z" /></>,
  inbox: <><path d="M4 5h16v14H4z" /><path d="M4 13h4l2 3h4l2-3h4" /></>,
  booking: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
  live: <><circle cx="12" cy="12" r="3" /><path d="M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8" /></>,
  dispute: <><path d="m12 3 9 17H3L12 3Z" /><path d="M12 9v4m0 3h.01" /></>,
  traveler: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  buddy: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="10" r="2.5" /><path d="M3 21a6 6 0 0 1 12 0m0-5a5 5 0 0 1 6 5" /></>,
  route: <><circle cx="6" cy="18" r="2" /><circle cx="18" cy="6" r="2" /><path d="M8 18h3a4 4 0 0 0 4-4v0a4 4 0 0 0-4-4H9a3 3 0 0 1-3-3V6" /></>,
  review: <><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" /></>,
  sos: <><circle cx="12" cy="12" r="9" /><path d="M12 7v6m0 4h.01" /></>,
  report: <><path d="M5 21V4m0 1h11l-2 4 2 4H5" /></>,
  shield: <><path d="M12 3 4 6v5c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V6l-8-3Z" /><path d="m9 12 2 2 4-5" /></>,
  delete: <><path d="M4 7h16M9 7V4h6v3m3 0-1 14H7L6 7m4 4v6m4-6v6" /></>,
  money: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 9h18m-5 5h2" /></>,
  refund: <><path d="M4 9h11a5 5 0 1 1 0 10h-3" /><path d="m8 5-4 4 4 4" /></>,
  payout: <><path d="M12 3v18m5-14H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H7" /></>,
  pricing: <><path d="M20 13 13 20l-9-9V4h7l9 9Z" /><circle cx="8" cy="8" r="1" /></>,
  growth: <><path d="M4 19V9m6 10V5m6 14v-7m4 7H2" /></>,
  content: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h4" /></>,
  notification: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 13h4" /></>,
  jobs: <><path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1m-8.6 8.6-2.1 2.1" /><circle cx="12" cy="12" r="4" /></>,
  audit: <><path d="M5 3h14v18H5z" /><path d="M9 8h6m-6 4h6m-6 4h4" /></>,
  team: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2" /><path d="M3 21a6 6 0 0 1 12 0m1-6a5 5 0 0 1 5 5" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H3v-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6V3h4v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" /></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
  close: <><path d="m6 6 12 12M18 6 6 18" /></>,
  refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M18.5 9A7 7 0 0 0 6 6.5L4 9m2 6a7 7 0 0 0 12 2.5l2-2.5" /></>,
  arrow: <><path d="M5 12h14m-5-5 5 5-5 5" /></>,
  warning: <><path d="m12 3 9 17H3L12 3Z" /><path d="M12 9v4m0 3h.01" /></>,
  check: <><path d="m5 12 4 4L19 6" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  external: <><path d="M14 4h6v6m0-6-9 9" /><path d="M18 13v7H4V6h7" /></>,
  chevron: <><path d="m9 6 6 6-6 6" /></>,
  filter: <><path d="M4 5h16l-6 7v6l-4 2v-8L4 5Z" /></>,
};

export default function Icon({ name, ...props }: { name: IconName } & SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {paths[name]}
    </svg>
  );
}
