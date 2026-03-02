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
  repos: string[] | null; // null means fetch all repos
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

const fetchEntryData = async (
  entry: UserQuery,
  options: DataOptions,
): Promise<{ names: string[]; langs: Record<string, number>[] }> => {
  let repoNames: string[];
  if (entry.repos) {
    repoNames = entry.repos;
  } else {
    repoNames = await repositories(entry.owner, options.includeForks);
  }
  const langs = await languages(entry.owner, repoNames);
  return { names: repoNames, langs: langs.flat() };
};

const data = async (input: string, options: DataOptions = {}) => {
  try {
    window.history.pushState('', '', `/${input}`);

    // Split by + for multiple users
    const entries = input
      .split('+')
      .map((e) => e.trim())
      .filter((e) => e.length > 0)
      .map(parseEntry);

    const results = await Promise.all(
      entries.map((entry) => fetchEntryData(entry, options)),
    );

    const allNames = results.flatMap((r) => r.names);
    const allLangs = results.flatMap((r) => r.langs);
    const space = getSize(allLangs);

    return { data: { allNames, space } };
  } catch (error) {
    console.error('Error getting langs', error);
    throw error;
  }
};

export default data;
