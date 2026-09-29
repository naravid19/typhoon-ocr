// Update checking against GitHub Releases. Server-side only; no imports from Next.js so `npm test` can run it.
import { execFile } from "node:child_process";

export interface Release {
  tag: string;
  title: string;
  notes: string; // plain text
  url: string;
}

interface ParsedVersion {
  nums: [number, number, number];
  prerelease: boolean;
}

function parseVersion(text: string): ParsedVersion | null {
  const m = /^v?(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.exec(text.trim());
  if (!m) return null;
  return { nums: [Number(m[1]), Number(m[2]), Number(m[3])], prerelease: /-/.test(text) };
}

/** True only when `latest` is a readable version strictly newer than `current`. */
export function isNewer(latest: string, current: string): boolean {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) {
    if (a.nums[i] !== b.nums[i]) return a.nums[i] > b.nums[i];
  }
  return b.prerelease && !a.prerelease; // 1.2.0 is newer than 1.2.0-beta.1
}

const ENTITIES: Record<string, string> = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'", nbsp: " " };

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === "#") {
      const code = body[1].toLowerCase() === "x" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[body.toLowerCase()] ?? whole;
  });
}

function htmlToText(html: string): string {
  const text = html
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<\/(li|p|h[1-6]|ul|ol|div|pre)>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  return decodeEntities(text)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

/** Parse GitHub's releases.atom (newest first). Entries it cannot read are skipped. */
export function parseReleasesAtom(xml: string): Release[] {
  const releases: Release[] = [];
  for (const entry of xml.split("<entry>").slice(1)) {
    const url = /<link[^>]*rel="alternate"[^>]*href="([^"]+)"/.exec(entry)?.[1];
    const tag = url?.split("/releases/tag/")[1];
    if (!url || !tag) continue;
    const title = decodeEntities(/<title>([\s\S]*?)<\/title>/.exec(entry)?.[1] ?? tag).trim();
    const content = /<content[^>]*>([\s\S]*?)<\/content>/.exec(entry)?.[1] ?? "";
    // The feed carries the release notes as HTML that is itself XML-escaped: decode once, then flatten the HTML
    releases.push({ tag: decodeURIComponent(tag), title, notes: htmlToText(decodeEntities(content)), url });
  }
  return releases;
}

/** Highest stable (non pre-release) release, regardless of feed order. */
export function latestStable(releases: Release[]): Release | null {
  let best: Release | null = null;
  for (const release of releases) {
    const v = parseVersion(release.tag);
    if (!v || v.prerelease) continue;
    if (!best || isNewer(release.tag, best.tag)) best = release;
  }
  return best;
}

type FetchLike = (url: string, init?: { headers?: Record<string, string> }) => Promise<Response>;

export interface ReleaseCheckerOptions {
  fetchImpl?: FetchLike;
  now?: () => number;
  ttlMs?: number;
  repo?: string;
}

const FAILURE_RETRY_MS = 10 * 60 * 1000;

const defaultFetch: FetchLike = (url, init) =>
  fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(8000) });

/**
 * Latest stable release from GitHub's releases.atom feed. The feed is used instead of api.github.com because the
 * API allows only 60 unauthenticated requests/hour per IP. Results are cached, revalidated with the ETag, and
 * every failure degrades to "last known release" (or null) instead of throwing.
 */
export function createReleaseChecker(options: ReleaseCheckerOptions = {}) {
  const fetchImpl = options.fetchImpl ?? defaultFetch;
  const now = options.now ?? Date.now;
  const ttlMs = options.ttlMs ?? 6 * 60 * 60 * 1000;
  const feedUrl = `https://github.com/${options.repo ?? "naravid19/typhoon-ocr"}/releases.atom`;

  let release: Release | null = null;
  let etag: string | null = null;
  let nextCheckAt = 0;
  let inflight: Promise<Release | null> | null = null;

  async function refresh(): Promise<Release | null> {
    try {
      const headers: Record<string, string> = { "User-Agent": "Typhoon-OCR-App", Accept: "application/atom+xml" };
      if (etag) headers["If-None-Match"] = etag;
      const res = await fetchImpl(feedUrl, { headers });
      if (res.status === 200) {
        release = latestStable(parseReleasesAtom(await res.text()));
        etag = res.headers.get("ETag");
        nextCheckAt = now() + ttlMs;
      } else if (res.status === 304) {
        nextCheckAt = now() + ttlMs;
      } else {
        nextCheckAt = now() + FAILURE_RETRY_MS;
      }
    } catch {
      nextCheckAt = now() + FAILURE_RETRY_MS; // offline: keep whatever we knew
    }
    return release;
  }

  return {
    async latest(): Promise<Release | null> {
      if (now() < nextCheckAt) return release;
      inflight ??= refresh().finally(() => {
        inflight = null;
      });
      return inflight;
    },
  };
}

// ---- Applying an update ------------------------------------------------------------------------------------------

export type GitRunner = (args: string[]) => Promise<string>;

/** Runs git (no shell, so nothing is ever interpolated into a command line). Rejects with git's own message. */
export function gitRunner(cwd: string): GitRunner {
  return (args) =>
    new Promise((resolve, reject) => {
      execFile("git", args, { cwd, timeout: 60_000, windowsHide: true }, (error, stdout, stderr) => {
        if (error) reject(new Error((stderr || error.message).trim()));
        else resolve(stdout.trim());
      });
    });
}

export type UpdateFailure = "invalid-tag" | "not-git" | "wrong-branch" | "dirty" | "fetch-failed" | "diverged";

export type UpdateResult =
  | { success: true; from: string; to: string; dependenciesChanged: boolean }
  | { success: false; code: UpdateFailure; error: string };

const TAG = /^v\d+\.\d+\.\d+$/;
const DEPENDENCY_FILE = /(^|\/)(package\.json|package-lock\.json|requirements\.txt)$/;
const UPDATABLE_BRANCHES = ["master", "main"];

/** Why this copy cannot be updated in place, or null when it can. */
export async function selfUpdateBlocker(
  git: GitRunner,
): Promise<{ code: Extract<UpdateFailure, "not-git" | "wrong-branch" | "dirty">; error: string } | null> {
  try {
    await git(["rev-parse", "--is-inside-work-tree"]);
  } catch {
    return { code: "not-git", error: "This copy was not installed with git, so it cannot update itself. Download the new version instead." };
  }
  const branch = await git(["rev-parse", "--abbrev-ref", "HEAD"]);
  if (!UPDATABLE_BRANCHES.includes(branch)) {
    return { code: "wrong-branch", error: `You are on branch "${branch}". Switch to master or main to update.` };
  }
  // Untracked files are ignored: they cannot be overwritten by a fast-forward unless the release adds the same path
  if (await git(["status", "--porcelain", "--untracked-files=no"])) {
    return { code: "dirty", error: "You have uncommitted changes. Commit or stash them before updating." };
  }
  return null;
}

/** Fast-forwards the current branch to a published release tag. Never merges, never pulls unreleased commits. */
export async function applyUpdate(tag: string, git: GitRunner): Promise<UpdateResult> {
  if (!TAG.test(tag)) return { success: false, code: "invalid-tag", error: `"${tag}" is not a release version.` };

  const blocker = await selfUpdateBlocker(git);
  if (blocker) return { success: false, ...blocker };

  const from = await git(["rev-parse", "HEAD"]);
  try {
    await git(["fetch", "--no-tags", "origin", `refs/tags/${tag}:refs/tags/${tag}`]);
  } catch (e) {
    return { success: false, code: "fetch-failed", error: `Could not download ${tag} from GitHub: ${(e as Error).message}` };
  }
  try {
    await git(["merge", "--ff-only", `refs/tags/${tag}`]);
  } catch {
    return {
      success: false,
      code: "diverged",
      error: `This copy has commits that are not part of ${tag}, so it cannot be fast-forwarded. Update manually with git.`,
    };
  }

  const to = await git(["rev-parse", "HEAD"]);
  const changed = from === to ? [] : (await git(["diff", "--name-only", from, to])).split("\n");
  return { success: true, from, to, dependenciesChanged: changed.some((file) => DEPENDENCY_FILE.test(file)) };
}

/** One checker per server process, shared by the check and update routes. */
export const releaseChecker = createReleaseChecker();
