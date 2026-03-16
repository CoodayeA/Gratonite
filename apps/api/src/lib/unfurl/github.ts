/**
 * lib/unfurl/github.ts — GitHub URL unfurling for rich embeds.
 *
 * Parses GitHub URLs (repos, issues, PRs, commits) and fetches metadata
 * from the GitHub REST API. Results are cached in memory with a 5-minute TTL
 * to stay within rate limits.
 *
 * @module lib/unfurl/github
 */

import { logger } from '../logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GitHubEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface GitHubEmbed {
  type: 'github';
  url: string;
  title: string;
  description?: string;
  color: string;
  fields: GitHubEmbedField[];
  thumbnail?: string;
  footer?: string;
}

// ---------------------------------------------------------------------------
// In-memory cache (Map with TTL)
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  data: GitHubEmbed | null;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

// Periodic cleanup every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (now >= entry.expiresAt) {
      cache.delete(key);
    }
  }
}, 60_000).unref();

function getCached(url: string): GitHubEmbed | null | undefined {
  const entry = cache.get(url);
  if (!entry) return undefined;
  if (Date.now() >= entry.expiresAt) {
    cache.delete(url);
    return undefined;
  }
  return entry.data;
}

function setCache(url: string, data: GitHubEmbed | null): void {
  cache.set(url, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ---------------------------------------------------------------------------
// GitHub API helpers
// ---------------------------------------------------------------------------

const GITHUB_URL_REGEX =
  /^https?:\/\/github\.com\/([a-zA-Z0-9._-]+)\/([a-zA-Z0-9._-]+)(?:\/(pull|issues|commit)\/([a-zA-Z0-9]+))?\/?$/;

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'Gratonite/1.0 (link-unfurler)',
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function githubFetch(apiPath: string): Promise<any> {
  const url = `https://api.github.com${apiPath}`;
  const res = await fetch(url, {
    headers: getHeaders(),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// State color mapping
// ---------------------------------------------------------------------------

function stateColor(state: string, merged?: boolean): string {
  if (merged) return '#8957e5'; // purple — merged
  switch (state) {
    case 'open':
      return '#238636'; // green
    case 'closed':
      return '#da3633'; // red
    default:
      return '#8b949e'; // grey
  }
}

// ---------------------------------------------------------------------------
// Unfurl functions per resource type
// ---------------------------------------------------------------------------

async function unfurlRepo(owner: string, repo: string, url: string): Promise<GitHubEmbed> {
  const data = await githubFetch(`/repos/${owner}/${repo}`);

  const fields: GitHubEmbedField[] = [];
  if (data.stargazers_count != null) {
    fields.push({ name: 'Stars', value: String(data.stargazers_count), inline: true });
  }
  if (data.forks_count != null) {
    fields.push({ name: 'Forks', value: String(data.forks_count), inline: true });
  }
  if (data.language) {
    fields.push({ name: 'Language', value: data.language, inline: true });
  }
  if (data.open_issues_count != null) {
    fields.push({ name: 'Open Issues', value: String(data.open_issues_count), inline: true });
  }

  return {
    type: 'github',
    url,
    title: `${owner}/${repo}`,
    description: data.description ? String(data.description).slice(0, 300) : undefined,
    color: '#8b949e',
    fields,
    thumbnail: data.owner?.avatar_url,
    footer: data.license?.spdx_id ? `License: ${data.license.spdx_id}` : undefined,
  };
}

async function unfurlPR(owner: string, repo: string, num: string, url: string): Promise<GitHubEmbed> {
  const data = await githubFetch(`/repos/${owner}/${repo}/pulls/${num}`);

  const fields: GitHubEmbedField[] = [
    { name: 'State', value: data.merged ? 'Merged' : data.state, inline: true },
    { name: 'Author', value: data.user?.login ?? 'unknown', inline: true },
  ];
  if (data.additions != null && data.deletions != null) {
    fields.push({ name: 'Changes', value: `+${data.additions} / -${data.deletions}`, inline: true });
  }
  if (data.labels && data.labels.length > 0) {
    fields.push({
      name: 'Labels',
      value: data.labels.map((l: any) => l.name).join(', '),
      inline: false,
    });
  }

  return {
    type: 'github',
    url,
    title: `#${num} ${data.title}`,
    description: data.body ? String(data.body).slice(0, 300) : undefined,
    color: stateColor(data.state, data.merged),
    fields,
    thumbnail: data.user?.avatar_url,
    footer: `${owner}/${repo} · Created ${new Date(data.created_at).toLocaleDateString()}`,
  };
}

async function unfurlIssue(owner: string, repo: string, num: string, url: string): Promise<GitHubEmbed> {
  const data = await githubFetch(`/repos/${owner}/${repo}/issues/${num}`);

  const fields: GitHubEmbedField[] = [
    { name: 'State', value: data.state, inline: true },
    { name: 'Author', value: data.user?.login ?? 'unknown', inline: true },
  ];
  if (data.comments != null) {
    fields.push({ name: 'Comments', value: String(data.comments), inline: true });
  }
  if (data.labels && data.labels.length > 0) {
    fields.push({
      name: 'Labels',
      value: data.labels.map((l: any) => l.name).join(', '),
      inline: false,
    });
  }

  return {
    type: 'github',
    url,
    title: `#${num} ${data.title}`,
    description: data.body ? String(data.body).slice(0, 300) : undefined,
    color: stateColor(data.state),
    fields,
    thumbnail: data.user?.avatar_url,
    footer: `${owner}/${repo} · Created ${new Date(data.created_at).toLocaleDateString()}`,
  };
}

async function unfurlCommit(owner: string, repo: string, sha: string, url: string): Promise<GitHubEmbed> {
  const data = await githubFetch(`/repos/${owner}/${repo}/commits/${sha}`);

  const shortSha = data.sha ? String(data.sha).slice(0, 7) : sha.slice(0, 7);
  const message = data.commit?.message ?? '';
  const firstLine = message.split('\n')[0].slice(0, 200);

  const fields: GitHubEmbedField[] = [
    { name: 'Author', value: data.commit?.author?.name ?? data.author?.login ?? 'unknown', inline: true },
    { name: 'SHA', value: shortSha, inline: true },
  ];
  if (data.stats) {
    fields.push({
      name: 'Changes',
      value: `+${data.stats.additions} / -${data.stats.deletions} (${data.stats.total} total)`,
      inline: true,
    });
  }

  return {
    type: 'github',
    url,
    title: firstLine,
    description: message.includes('\n') ? message.slice(firstLine.length + 1).slice(0, 300) : undefined,
    color: '#8b949e',
    fields,
    thumbnail: data.author?.avatar_url,
    footer: `${owner}/${repo} · ${shortSha}`,
  };
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * unfurlGitHubUrl — Parse a GitHub URL and fetch rich embed data.
 *
 * Supports:
 *   - /owner/repo — repository overview
 *   - /owner/repo/pull/N — pull request details
 *   - /owner/repo/issues/N — issue details
 *   - /owner/repo/commit/SHA — commit details
 *
 * Returns null for non-matching URLs or API failures.
 */
export async function unfurlGitHubUrl(url: string): Promise<GitHubEmbed | null> {
  const match = url.match(GITHUB_URL_REGEX);
  if (!match) return null;

  // Check cache first
  const cached = getCached(url);
  if (cached !== undefined) return cached;

  const [, owner, repo, resourceType, resourceId] = match;

  try {
    let result: GitHubEmbed;

    if (!resourceType) {
      // Repository
      result = await unfurlRepo(owner, repo, url);
    } else if (resourceType === 'pull' && resourceId) {
      result = await unfurlPR(owner, repo, resourceId, url);
    } else if (resourceType === 'issues' && resourceId) {
      result = await unfurlIssue(owner, repo, resourceId, url);
    } else if (resourceType === 'commit' && resourceId) {
      result = await unfurlCommit(owner, repo, resourceId, url);
    } else {
      setCache(url, null);
      return null;
    }

    setCache(url, result);
    return result;
  } catch (err) {
    logger.warn({ msg: 'GitHub unfurl failed', url, err });
    setCache(url, null);
    return null;
  }
}
