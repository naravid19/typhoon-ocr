import { NextResponse } from 'next/server';
import { applyUpdate, gitRunner, releaseChecker } from '@/lib/updates';

// Fast-forwards this copy to the latest published release (never to unreleased commits on the branch).
export async function POST(request: Request) {
  // Local, state-changing endpoint: refuse requests that another website's page fired at us
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== request.headers.get('host')) {
    return NextResponse.json({ success: false, error: 'Cross-origin request refused.' }, { status: 403 });
  }

  const { tag } = await request.json().catch(() => ({ tag: undefined }));
  const latest = await releaseChecker.latest();
  if (typeof tag !== 'string' || !latest || latest.tag !== tag) {
    return NextResponse.json(
      { success: false, error: 'That is no longer the latest release. Check for updates again.' },
      { status: 409 }
    );
  }

  try {
    const result = await applyUpdate(tag, gitRunner(process.cwd()));
    if (!result.success) {
      return NextResponse.json(
        { success: false, code: result.code, error: result.error },
        { status: result.code === 'invalid-tag' ? 400 : 409 }
      );
    }
    return NextResponse.json({
      success: true,
      from: result.from.substring(0, 7),
      to: result.to.substring(0, 7),
      dependenciesChanged: result.dependenciesChanged,
    });
  } catch (error) {
    console.error('[Update Error]:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Update failed' },
      { status: 500 }
    );
  }
}
