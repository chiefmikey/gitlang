import getSize from './helpers/size';
import { contributorLanguages } from './requests/contributors';
import languages from './requests/languages';
import merged from './requests/merged';
import repositories from './requests/repositories';

interface DataOptions {
  includeForks?: boolean;
}

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
    return { owner, repos, author };
  }
  return { owner: parseOwnerName(entryWithoutAuthor), repos: null, author };
};

interface RepoLangs {
  name: string;
  langs: Record<string, number>;
}

const fetchEntryData = async (
  entry: UserQuery,
  options: DataOptions,
): Promise<{ repoLangs: RepoLangs[] }> => {
  // Fast path: use merged endpoint for full-user lookups (no specific repos, no author)
  if (!entry.repos && !entry.author) {
    const result = await merged(entry.owner, options.includeForks);
    const repoLangs: RepoLangs[] = result.repos.map((name, i) => ({
      name,
      langs: result.langs[i] || {},
    }));
    return { repoLangs };
  }

  let repoNames: string[];
  if (entry.repos) {
    repoNames = entry.repos;
  } else {
    repoNames = await repositories(entry.owner, options.includeForks);
  }

  if (entry.author) {
    // Contributor mode: fetch commit-level language data per repo for this author
    const langResults = await Promise.all(
      repoNames.map((repo) =>
        contributorLanguages(entry.owner, repo, entry.author as string),
      ),
    );
    const repoLangs: RepoLangs[] = repoNames.map((name, i) => ({
      name,
      langs: langResults[i] || {},
    }));
    return { repoLangs };
  }

  const langs = await languages(entry.owner, repoNames);

  const repoLangs: RepoLangs[] = repoNames.map((name, i) => ({
    name,
    langs: langs[i] || {},
  }));

  return { repoLangs };
};

const buildLangRepoBreakdown = (
  repoLangs: RepoLangs[],
): Record<string, { repo: string; percent: number }[]> => {
  const langTotals: Record<string, number> = {};
  const langRepos: Record<string, { repo: string; bytes: number }[]> = {};

  for (const { name, langs } of repoLangs) {
    for (const [lang, bytes] of Object.entries(langs)) {
      langTotals[lang] = (langTotals[lang] || 0) + bytes;
      if (!langRepos[lang]) {
        langRepos[lang] = [];
      }
      langRepos[lang].push({ repo: name, bytes });
    }
  }

  const breakdown: Record<string, { repo: string; percent: number }[]> = {};
  for (const [lang, repos] of Object.entries(langRepos)) {
    const total = langTotals[lang];
    breakdown[lang] = repos
      .map(({ repo, bytes }) => ({
        repo,
        percent: total > 0 ? bytes / total : 0,
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

const processGroup = async (
  groupInput: string,
  options: DataOptions,
): Promise<GroupResult> => {
  const entries = groupInput
    .split('+')
    .map((e) => e.trim())
    .filter((e) => e.length > 0)
    .map(parseEntry);

  const results = await Promise.all(
    entries.map((entry) => fetchEntryData(entry, options)),
  );

  const allRepoLangs = results.flatMap((r) => r.repoLangs);
  const allNames = allRepoLangs.map((r) => r.name);
  const allLangs = allRepoLangs.map((r) => r.langs);
  const space = getSize(allLangs);
  const langBreakdown = buildLangRepoBreakdown(allRepoLangs);

  return { label: groupInput, allNames, space, langBreakdown };
};

const data = async (input: string, options: DataOptions = {}) => {
  try {
    window.history.pushState('', '', `/${input}`);

    // Split by ~ for compare mode (? in input becomes ~ in URL)
    const groups = input
      .split('~')
      .map((g) => g.trim().replace(/^\++|\++$/g, ''))
      .filter((g) => g.length > 0);

    if (groups.length <= 1) {
      // Single group — standard compile mode
      const result = await processGroup(groups[0] || input, options);
      return {
        data: {
          allNames: result.allNames,
          space: result.space,
          langBreakdown: result.langBreakdown,
        },
      };
    }

    // Multiple groups — compare mode
    const results = await Promise.all(
      groups.map((group) => processGroup(group, options)),
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

export default data;
