import getSize from './helpers/size';
import { contributorLanguages } from './requests/contributors';
import languages from './requests/languages';
import merged from './requests/merged';
import repositories from './requests/repositories';

const parseOwnerName = (input: string): string => {
  if (input.startsWith('@')) {
    return input.slice(1);
  }
  if (input.startsWith('org:') || input.startsWith('org/')) {
    return input.slice(4);
  }
  return input;
};

interface UserQuery {
  owner: string;
  repos: string[] | null;
  author: string | null;
}

const parseEntry = (entry: string): UserQuery => {
  // Extract @author filter if present (e.g., user/repo@author)
  let author: string | null = null;
  let entryWithoutAuthor = entry;
  const atIndex = entry.lastIndexOf('@');
  if (atIndex > 0) {
    author = entry.slice(atIndex + 1);
    entryWithoutAuthor = entry.slice(0, atIndex);
  }

  if (entryWithoutAuthor.includes('/')) {
    const parts = entryWithoutAuthor.split('/');
    const owner = parseOwnerName(parts[0]);
    const repos = parts
      .slice(1)
      .flatMap((part) => part.split(','))
      .filter((name) => name.length > 0);
    return { author, owner, repos };
  }
  return { author, owner: parseOwnerName(entryWithoutAuthor), repos: null };
};

interface RepoLangs {
  name: string;
  langs: Record<string, number>;
}

const fetchEntryData = async (
  entry: UserQuery,
): Promise<{ repoLangs: RepoLangs[] }> => {
  const { author, owner, repos } = entry;
  const hasAuthor = author !== null && author !== '';

  // Fast path: use merged endpoint for full-user lookups (no specific repos, no author)
  if (repos === null && !hasAuthor) {
    const result = await merged(owner);
    const repoLangs: RepoLangs[] = result.repos.map((name, index) => ({
      langs: result.langs[index] ?? {},
      name,
    }));
    return { repoLangs };
  }

  // In author mode, include forks — contributor analysis isolates the author's work
  const repoNames = repos ?? (await repositories(owner, hasAuthor));

  if (hasAuthor) {
    // Contributor mode: fetch commit-level language data per repo for this author
    const langResults = await Promise.all(
      repoNames.map(async (repo) => contributorLanguages(owner, repo, author)),
    );
    const repoLangs: RepoLangs[] = repoNames.map((name, index) => ({
      langs: langResults[index] ?? {},
      name,
    }));
    return { repoLangs };
  }

  const langs = await languages(owner, repoNames);

  const repoLangs: RepoLangs[] = repoNames.map((name, index) => ({
    langs: langs[index] ?? {},
    name,
  }));

  return { repoLangs };
};

const buildLangRepoBreakdown = (
  repoLangs: RepoLangs[],
): Record<string, { repo: string; percent: number }[]> => {
  const langTotals: Record<string, number> = {};
  const langRepos: Record<string, { repo: string; bytes: number }[]> = {};

  for (const { langs, name } of repoLangs) {
    for (const [lang, bytes] of Object.entries(langs)) {
      langTotals[lang] = (langTotals[lang] ?? 0) + bytes;
      if (langRepos[lang] === undefined) {
        langRepos[lang] = [];
      }
      langRepos[lang].push({ bytes, repo: name });
    }
  }

  const breakdown: Record<string, { repo: string; percent: number }[]> = {};
  for (const [lang, repos] of Object.entries(langRepos)) {
    const total = langTotals[lang];
    breakdown[lang] = repos
      .map(({ bytes, repo }) => ({
        percent: total > 0 ? bytes / total : 0,
        repo,
      }))
      .sort((a, b) => b.percent - a.percent);
  }

  return breakdown;
};

interface GroupResult {
  label: string;
  allNames: string[];
  space: Record<string, number>;
  langBreakdown: Record<string, { repo: string; percent: number }[]>;
}

const processGroup = async (groupInput: string): Promise<GroupResult> => {
  const entries = groupInput
    .split('+')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map(parseEntry);

  const results = await Promise.all(
    entries.map(async (entry) => fetchEntryData(entry)),
  );

  const allRepoLangs = results.flatMap((r) => r.repoLangs);
  const allNames = allRepoLangs.map((r) => r.name);
  const allLangs = allRepoLangs.map((r) => r.langs);
  const space = getSize(allLangs);
  const langBreakdown = buildLangRepoBreakdown(allRepoLangs);

  return { allNames, label: groupInput, langBreakdown, space };
};

interface DataResult {
  data:
    {
        allNames: string[];
        langBreakdown: GroupResult['langBreakdown'];
        space: Record<string, number>;
      } | { compareGroups: GroupResult[] };
}

const data = async (input: string): Promise<DataResult> => {
  try {
    globalThis.history.pushState('', '', `/${input}`);

    // Split by ~ for compare mode (? in input becomes ~ in URL)
    const groups = input
      .split('~')
      .map((g) => g.trim().replaceAll(/^\++|\++$/gu, ''))
      .filter((g) => g.length > 0);

    if (groups.length <= 1) {
      // Single group — standard compile mode
      const result = await processGroup(groups[0] ?? input);
      return {
        data: {
          allNames: result.allNames,
          langBreakdown: result.langBreakdown,
          space: result.space,
        },
      };
    }

    // Multiple groups — compare mode
    const results = await Promise.all(
      groups.map(async (group) => processGroup(group)),
    );

    return {
      data: {
        compareGroups: results,
      },
    };
  } catch (error) {
    console.error('Error getting langs', error);
    throw error;
  }
};

export { buildLangRepoBreakdown, parseEntry, parseOwnerName };
export default data;
