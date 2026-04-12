/**
 * M2 prototype demo route — /m2-prototype
 *
 * Mounts <DesktopScrollLayout /> in isolation with hardcoded mock data.
 * Per handoff §M2.1: build the hardest UI component proven in isolation
 * before building anything else. This route exists ONLY for development
 * verification of the M2 acceptance criteria; it is NOT part of the
 * public route map (handoff §4) and will be deleted (or gated behind
 * NODE_ENV !== 'production') before deploy in M6.
 */

import DesktopScrollLayout from '@/components/DesktopScrollLayout/DesktopScrollLayout'

export const metadata = {
  title: 'M2 prototype — DesktopScrollLayout',
}

export default function M2PrototypePage() {
  return <DesktopScrollLayout entries={[]} />
}
