import getSize from './helpers/size';
import languages from './requests/languages';
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
}

const parseEntry = (entry: string): UserQuery => {
  if (entry.includes('/')) {
    const parts = entry.split('/');
    const owner = parseOwnerName(parts[0]);
    const repos = parts
      .slice(1)
      .flatMap((part) => part.split(','))
      .filter((name) => name.length > 0);
    return { owner, repos };
  }
  return { owner: parseOwnerName(entry), repos: null };
};

interface RepoLangs {
  name: string;
  langs: Record<string, number>;
}

const fetchEntryData = async (
  entry: UserQuery,
  options: DataOptions,
): Promise<{ repoLangs: RepoLangs[] }> => {
  let repoNames: string[];
  if (entry.repos) {
    repoNames = entry.repos;
  } else {
    repoNames = await repositories(entry.owner, options.includeForks);
  }
  const langs = await languages(entry.owner, repoNames);

  const repoLangs: RepoLangs[] = repoNames.map((name, i) => ({
    name,
    langs: langs[i] || {},
  }));

  return { repoLangs };
};

// Build per-language repo breakdown: { "TypeScript": [{ repo: "gitlang", bytes: 1234, percent: 0.75 }, ...] }
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

const data = async (input: string, options: DataOptions = {}) => {
  try {
    window.history.pushState('', '', `/${input}`);

    const entries = input
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

    return { data: { allNames, space, langBreakdown } };
  } catch (error) {
    console.error('Error getting langs', error);
    throw error;
  }
};

export default data;
