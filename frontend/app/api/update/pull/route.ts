import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST() {
  try {
    // 1. Check local branch
    const { stdout: localBranchOutput } = await execAsync('git rev-parse --abbrev-ref HEAD');
    const branch = localBranchOutput.trim() || 'main';

    // Security: Validate branch name to prevent shell command injection
    if (!/^[a-zA-Z0-9_\-\.\/]+$/.test(branch)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid branch name: ${branch}`,
        },
        { status: 400 }
      );
    }

    // 2. Check git status to ensure working directory is clean
    const { stdout: statusOutput } = await execAsync('git status --porcelain');
    if (statusOutput.trim().length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Local uncommitted changes detected. Please stash or commit your changes before updating.',
          details: statusOutput.trim(),
        },
        { status: 400 }
      );
    }

    // 3. Execute git pull safely
    const { stdout: pullOutput, stderr: pullStderr } = await execAsync(`git pull origin "${branch}"`);

    return NextResponse.json({
      success: true,
      message: 'Successfully pulled latest changes from origin.',
      output: pullOutput || pullStderr,
    });
  } catch (error) {
    console.error('[Update Pull Error]:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to execute git pull',
      },
      { status: 500 }
    );
  }
}
