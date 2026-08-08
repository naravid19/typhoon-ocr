import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function GET() {
  try {
    // Get current local commit SHA and branch
    const { stdout: localBranchOutput } = await execAsync('git rev-parse --abbrev-ref HEAD');
    const branch = localBranchOutput.trim() || 'main';

    const { stdout: localShaOutput } = await execAsync('git rev-parse HEAD');
    const localSHA = localShaOutput.trim();

    // Fetch latest commit from GitHub remote repo
    const response = await fetch(`https://api.github.com/repos/naravid19/typhoon-ocr/commits/${branch}`, {
      headers: {
        'User-Agent': 'Typhoon-OCR-App',
        'Accept': 'application/vnd.github.v3+json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return NextResponse.json({
        hasUpdate: false,
        error: `GitHub API returned status ${response.status}`,
        localSHA: localSHA.substring(0, 7),
      });
    }

    const data = await response.json();
    const remoteSHA = data.sha;

    const hasUpdate = localSHA !== remoteSHA;

    return NextResponse.json({
      hasUpdate,
      localSHA: localSHA.substring(0, 7),
      remoteSHA: remoteSHA ? remoteSHA.substring(0, 7) : 'unknown',
      commitMessage: data.commit?.message?.split('\n')[0] || '',
      branch,
    });
  } catch (error) {
    console.error('[Update Check Error]:', error);
    return NextResponse.json({
      hasUpdate: false,
      error: error instanceof Error ? error.message : 'Failed to check updates',
    });
  }
}
