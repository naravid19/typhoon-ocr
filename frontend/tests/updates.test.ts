// Run with: npm test   (node's built-in runner; no extra dependencies)
import assert from "node:assert/strict";
import { test } from "node:test";
import { isNewer, latestStable, parseReleasesAtom } from "../lib/updates.ts";

// Trimmed from the real https://github.com/naravid19/typhoon-ocr/releases.atom (v1.1.2 entry, content cut)
const entry = (tag: string, html: string) => `
  <entry>
    <id>tag:github.com,2008:Repository/998247358/${tag}</id>
    <updated>2026-09-27T09:19:41Z</updated>
    <link rel="alternate" type="text/html" href="https://github.com/naravid19/typhoon-ocr/releases/tag/${tag}"/>
    <title>${tag}</title>
    <content type="html">${html}</content>
    <author><name>naravid19</name></author>
  </entry>`;

const NOTES_HTML =
  "&lt;h2&gt;What&#39;s Changed&lt;/h2&gt;\n&lt;ul&gt;\n&lt;li&gt;&lt;strong&gt;Enterprise Dark Theme&lt;/strong&gt;: Obsidian (&lt;code&gt;#09090b&lt;/code&gt;)&lt;/li&gt;\n&lt;li&gt;Tabs &amp;amp; layout&lt;/li&gt;\n&lt;/ul&gt;";

const FEED = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"><title>Release notes from typhoon-ocr</title>${entry("v1.2.0-beta.1", "beta")}${entry("v1.1.2", NOTES_HTML)}${entry("v1.1.1", "old")}</feed>`;

test("isNewer compares release tags numerically, not as text", () => {
  assert.equal(isNewer("v1.1.3", "1.1.2"), true);
  assert.equal(isNewer("v1.10.0", "1.9.9"), true); // string compare would say 1.10 < 1.9
  assert.equal(isNewer("v1.1.2", "1.1.2"), false);
  assert.equal(isNewer("v1.1.1", "1.1.2"), false); // local copy is ahead of the release: no update
  assert.equal(isNewer("v2.0.0", "1.99.99"), true);
});

test("isNewer ignores tags it cannot read instead of guessing", () => {
  assert.equal(isNewer("nightly", "1.1.2"), false);
  assert.equal(isNewer("v1.1.3", "not-a-version"), false);
});

test("parseReleasesAtom reads tag, title, link and plain-text notes", () => {
  const releases = parseReleasesAtom(FEED);

  assert.deepEqual(releases.map((r) => r.tag), ["v1.2.0-beta.1", "v1.1.2", "v1.1.1"]);
  const v112 = releases[1];
  assert.equal(v112.url, "https://github.com/naravid19/typhoon-ocr/releases/tag/v1.1.2");
  assert.equal(v112.title, "v1.1.2");
  assert.equal(v112.notes, "What's Changed\n• Enterprise Dark Theme: Obsidian (#09090b)\n• Tabs & layout");
});

test("latestStable skips pre-releases and takes the highest version, whatever the feed order", () => {
  const releases = parseReleasesAtom(FEED);
  assert.equal(latestStable(releases)?.tag, "v1.1.2");
  assert.equal(latestStable([...releases].reverse())?.tag, "v1.1.2");
  assert.equal(latestStable([]), null);
});

// ---- Slice 2: the checker (cache, ETag, offline) ----------------------------------------------------------------
import { createReleaseChecker } from "../lib/updates.ts";

const HOUR = 3600_000;

function fakeGitHub(responses: Array<{ status: number; body?: string; etag?: string } | Error>) {
  const calls: Array<{ url: string; ifNoneMatch?: string }> = [];
  const fetchImpl = async (url: string, init?: { headers?: Record<string, string> }) => {
    calls.push({ url, ifNoneMatch: init?.headers?.["If-None-Match"] });
    const next = responses.shift();
    if (!next) throw new Error("unexpected extra request");
    if (next instanceof Error) throw next;
    return new Response(next.body ?? "", { status: next.status, headers: next.etag ? { ETag: next.etag } : {} });
  };
  return { fetchImpl, calls };
}

test("checker reads the latest stable release from the atom feed, not the rate-limited API", async () => {
  const gh = fakeGitHub([{ status: 200, body: FEED, etag: 'W/"a"' }]);
  const checker = createReleaseChecker({ fetchImpl: gh.fetchImpl, now: () => 0 });

  const release = await checker.latest();

  assert.equal(release?.tag, "v1.1.2");
  assert.equal(gh.calls.length, 1);
  assert.match(gh.calls[0].url, /^https:\/\/github\.com\/naravid19\/typhoon-ocr\/releases\.atom$/);
});

test("checker does not hit GitHub again inside the cache window", async () => {
  const gh = fakeGitHub([{ status: 200, body: FEED }]);
  let clock = 0;
  const checker = createReleaseChecker({ fetchImpl: gh.fetchImpl, now: () => clock, ttlMs: 6 * HOUR });

  await checker.latest();
  clock = 5 * HOUR;
  const again = await checker.latest();

  assert.equal(gh.calls.length, 1);
  assert.equal(again?.tag, "v1.1.2");
});

test("after the window it revalidates with the ETag and keeps the release on 304", async () => {
  const gh = fakeGitHub([{ status: 200, body: FEED, etag: 'W/"a"' }, { status: 304 }]);
  let clock = 0;
  const checker = createReleaseChecker({ fetchImpl: gh.fetchImpl, now: () => clock, ttlMs: 6 * HOUR });

  await checker.latest();
  clock = 7 * HOUR;
  const revalidated = await checker.latest();

  assert.equal(gh.calls[1].ifNoneMatch, 'W/"a"');
  assert.equal(revalidated?.tag, "v1.1.2");
});

test("offline or a GitHub error never throws: last known release, or null when there is none", async () => {
  const cold = createReleaseChecker({ fetchImpl: fakeGitHub([new Error("ENOTFOUND")]).fetchImpl, now: () => 0 });
  assert.equal(await cold.latest(), null);

  const gh = fakeGitHub([{ status: 200, body: FEED }, { status: 503 }]);
  let clock = 0;
  const warm = createReleaseChecker({ fetchImpl: gh.fetchImpl, now: () => clock, ttlMs: HOUR });
  await warm.latest();
  clock = 2 * HOUR;
  assert.equal((await warm.latest())?.tag, "v1.1.2"); // stale beats nothing
});

// ---- Slice 3: applying an update with real git repositories -----------------------------------------------------
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyUpdate, gitRunner } from "../lib/updates.ts";

const IDENTITY = { GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" };
const sh = (cwd: string, ...args: string[]) =>
  execFileSync("git", args, { cwd, encoding: "utf8", env: { ...process.env, ...IDENTITY } }).trim();

/** origin (bare) + a maintainer clone that has published v1.0.0 + a user's copy at v1.0.0. */
function world() {
  const root = mkdtempSync(join(tmpdir(), "typhoon-upd-"));
  const origin = join(root, "origin.git");
  const dev = join(root, "dev");
  const user = join(root, "user");
  sh(root, "init", "--bare", "-b", "master", origin);
  sh(root, "clone", "-q", origin, dev);
  writeFileSync(join(dev, "README.md"), "v1.0.0");
  sh(dev, "add", "."); sh(dev, "commit", "-qm", "v1.0.0"); sh(dev, "branch", "-M", "master");
  sh(dev, "tag", "v1.0.0"); sh(dev, "push", "-q", "origin", "master", "v1.0.0");
  sh(root, "clone", "-q", origin, user);
  const release = (tag: string | null, files: Record<string, string>) => {
    for (const [name, content] of Object.entries(files)) {
      mkdirSync(join(dev, name, ".."), { recursive: true });
      writeFileSync(join(dev, name), content);
    }
    sh(dev, "add", "."); sh(dev, "commit", "-qm", tag ?? "unreleased"); if (tag) sh(dev, "tag", tag);
    sh(dev, "push", "-q", "origin", "master", ...(tag ? [tag] : []));
    return sh(dev, "rev-parse", "HEAD");
  };
  return { root, dev, user, release, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

test("applyUpdate fast-forwards to the release tag and reports what changed", async () => {
  const w = world();
  try {
    const tagged = w.release("v1.1.0", { "README.md": "v1.1.0" });

    const result = await applyUpdate("v1.1.0", gitRunner(w.user));

    assert.equal(result.success, true);
    assert.equal(sh(w.user, "rev-parse", "HEAD"), tagged);
    assert.equal(sh(w.user, "rev-parse", "--abbrev-ref", "HEAD"), "master"); // not detached
    assert.equal(result.success && result.dependenciesChanged, false);
  } finally { w.cleanup(); }
});

test("it stops at the release: unreleased commits on master are not pulled in", async () => {
  const w = world();
  try {
    const tagged = w.release("v1.1.0", { "README.md": "v1.1.0" });
    w.release(null, { "README.md": "unreleased work" }); // pushed to master, never tagged

    await applyUpdate("v1.1.0", gitRunner(w.user));

    assert.equal(sh(w.user, "rev-parse", "HEAD"), tagged);
  } finally { w.cleanup(); }
});

test("it tells the user to reinstall when dependency files changed", async () => {
  const w = world();
  try {
    w.release("v1.1.0", { "frontend/package-lock.json": "{}" });
    const result = await applyUpdate("v1.1.0", gitRunner(w.user));
    assert.equal(result.success && result.dependenciesChanged, true);
  } finally { w.cleanup(); }
});

test("uncommitted changes block the update and are left untouched", async () => {
  const w = world();
  try {
    w.release("v1.1.0", { "other.txt": "x" });
    writeFileSync(join(w.user, "README.md"), "my edit");
    const before = sh(w.user, "rev-parse", "HEAD");

    const result = await applyUpdate("v1.1.0", gitRunner(w.user));

    assert.deepEqual([result.success, !result.success && result.code], [false, "dirty"]);
    assert.equal(sh(w.user, "rev-parse", "HEAD"), before);
    assert.equal(sh(w.user, "status", "--porcelain"), "M README.md");
  } finally { w.cleanup(); }
});

test("local commits that are not in the release block a fast-forward instead of creating a merge", async () => {
  const w = world();
  try {
    w.release("v1.1.0", { "other.txt": "x" });
    writeFileSync(join(w.user, "mine.txt"), "local work");
    sh(w.user, "add", "."); sh(w.user, "commit", "-qm", "my change");
    const before = sh(w.user, "rev-parse", "HEAD");

    const result = await applyUpdate("v1.1.0", gitRunner(w.user));

    assert.deepEqual([result.success, !result.success && result.code], [false, "diverged"]);
    assert.equal(sh(w.user, "rev-parse", "HEAD"), before);
  } finally { w.cleanup(); }
});

test("only master or main can be updated, and a folder without git is reported as such", async () => {
  const w = world();
  try {
    w.release("v1.1.0", { "other.txt": "x" });
    sh(w.user, "checkout", "-qb", "feature");
    const onFeature = await applyUpdate("v1.1.0", gitRunner(w.user));
    assert.deepEqual([onFeature.success, !onFeature.success && onFeature.code], [false, "wrong-branch"]);

    const plain = mkdtempSync(join(tmpdir(), "typhoon-nogit-"));
    const noGit = await applyUpdate("v1.1.0", gitRunner(plain));
    assert.deepEqual([noGit.success, !noGit.success && noGit.code], [false, "not-git"]);
    rmSync(plain, { recursive: true, force: true });
  } finally { w.cleanup(); }
});

test("a tag that is not a plain version never reaches git", async () => {
  const calls: string[][] = [];
  const spy = async (args: string[]) => { calls.push(args); return ""; };

  for (const bad of ["v1.1.0; rm -rf /", "--upload-pack=evil", "main", "v1.1", "../v1.1.0"]) {
    const result = await applyUpdate(bad, spy);
    assert.deepEqual([result.success, !result.success && result.code], [false, "invalid-tag"], bad);
  }
  assert.equal(calls.length, 0);
});
