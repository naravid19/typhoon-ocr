import { NextResponse } from 'next/server';
import { gitRunner, isNewer, releaseChecker, selfUpdateBlocker } from '@/lib/updates';

// Compares this copy's version (root package.json) with the latest stable GitHub Release.
export async function GET() {
  const current = process.env.NEXT_PUBLIC_APP_VERSION ?? '';
  const latest = await releaseChecker.latest(); // never throws; null when offline or nothing is published
  const hasUpdate = latest !== null && isNewer(latest.tag, current);

  // Only spend git calls when there is something to update to
  const blocker = hasUpdate ? await selfUpdateBlocker(gitRunner(process.cwd())) : null;

  return NextResponse.json({
    hasUpdate,
    current,
    latest,
    canSelfUpdate: hasUpdate && blocker === null,
    blocker,
  });
}
