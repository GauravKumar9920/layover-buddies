// Thin re-export so the shared Inbox renders inside the traveler tab group.
// The actual screen lives at mobile/app/(shared)/messages/index.tsx so a
// single implementation powers both tab bars.
// Path: this file is at (traveler)/(tabs)/messages/index.tsx — three levels
// up to reach app/, then into (shared)/messages.
export { default } from '../../../(shared)/messages';
