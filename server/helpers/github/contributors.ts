import { Octokit } from '@octokit/rest';

// Map common file extensions to language names (matching GitHub's linguist)
const EXTENSION_MAP: Record<string, string> = {
  '.bash': 'Shell',
  '.c': 'C',
  '.cc': 'C++',
  '.cjs': 'JavaScript',
  '.clj': 'Clojure',
  '.cljs': 'Clojure',
  '.cpp': 'C++',
  '.cs': 'C#',
  '.css': 'CSS',
  '.cxx': 'C++',
  '.dart': 'Dart',
  '.dockerfile': 'Dockerfile',
  '.erl': 'Erlang',
  '.ex': 'Elixir',
  '.exs': 'Elixir',
  '.fish': 'Shell',
  '.fs': 'F#',
  '.fsx': 'F#',
  '.go': 'Go',
  '.h': 'C',
  '.hpp': 'C++',
  '.hrl': 'Erlang',
  '.hs': 'Haskell',
  '.htm': 'HTML',
  '.html': 'HTML',
  '.java': 'Java',
  '.jl': 'Julia',
  '.js': 'JavaScript',
  '.json': 'JSON',
  '.jsx': 'JavaScript',
  '.kt': 'Kotlin',
  '.kts': 'Kotlin',
  '.less': 'Less',
  '.lua': 'Lua',
  '.m': 'Objective-C',
  '.md': 'Markdown',
  '.mjs': 'JavaScript',
  '.ml': 'OCaml',
  '.mli': 'OCaml',
  '.mm': 'Objective-C',
  '.nim': 'Nim',
  '.php': 'PHP',
  '.pl': 'Perl',
  '.pm': 'Perl',
  '.ps1': 'PowerShell',
  '.py': 'Python',
  '.r': 'R',
  '.R': 'R',
  '.rb': 'Ruby',
  '.rs': 'Rust',
  '.rst': 'reStructuredText',
  '.sass': 'SCSS',
  '.scala': 'Scala',
  '.scss': 'SCSS',
  '.sh': 'Shell',
  '.sql': 'SQL',
  '.svelte': 'Svelte',
  '.swift': 'Swift',
  '.tex': 'TeX',
  '.tf': 'HCL',
  '.toml': 'TOML',
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript',
  '.vue': 'Vue',
  '.xml': 'XML',
  '.yaml': 'YAML',
  '.yml': 'YAML',
  '.zig': 'Zig',
  '.zsh': 'Shell',
};

const getExtension = (filename: string): string => {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) {
    // Handle extensionless files like Dockerfile, Makefile
    const base = filename.split('/').pop()?.toLowerCase() ?? '';
    if (base === 'dockerfile') {
      return '.dockerfile';
    }
    return '';
  }
  return filename.slice(lastDot).toLowerCase();
};

interface ContributorInfo {
  login: string;
  contributions: number;
  avatar_url: string;
}

const listContributors = async (
  owner: string,
  repo: string,
  token: string,
): Promise<ContributorInfo[]> => {
  try {
    if (token === '') {
      console.error('No token');
      return [];
    }
    const octokit = new Octokit({ auth: token });
    return await octokit.paginate(
      octokit.rest.repos.listContributors,
      { owner, per_page: 100, repo },
      (response) =>
        response.data.map(({ avatar_url, contributions, login }) => ({
          avatar_url: avatar_url === undefined ? '' : avatar_url,
          contributions,
          login: login === undefined ? 'unknown' : login,
        })),
    );
  } catch (error) {
    console.error('Error fetching contributors:', error);
    return [];
  }
};

const BATCH_SIZE = 5;

interface CommitFile {
  filename: string;
  additions?: number;
  deletions?: number;
}

const getFileChanges = (file: CommitFile): number => {
  const additions =
    file.additions !== undefined && file.additions > 0 ? file.additions : 0;
  const deletions =
    file.deletions !== undefined && file.deletions > 0 ? file.deletions : 0;
  return additions + deletions;
};

const accumulateFileLanguages = (
  files: CommitFile[],
): Record<string, number> => {
  const result: Record<string, number> = {};
  for (const file of files) {
    const extension = getExtension(file.filename);
    const lang = EXTENSION_MAP[extension];
    if (lang !== undefined) {
      const existing = result[lang];
      result[lang] =
        (existing === undefined ? 0 : existing) + getFileChanges(file);
    }
  }
  return result;
};

const processCommit = async (
  octokit: Octokit,
  owner: string,
  repo: string,
  sha: string,
): Promise<Record<string, number>> => {
  try {
    const commit = await octokit.rest.repos.getCommit({
      owner,
      ref: sha,
      repo,
    });
    if (commit.data.files === undefined) {
      return {};
    }
    return accumulateFileLanguages(commit.data.files);
  } catch {
    return {};
  }
};

const mergeLanguageCounts = (
  target: Record<string, number>,
  source: Record<string, number>,
): void => {
  for (const [lang, changes] of Object.entries(source)) {
    const existing = target[lang];
    target[lang] = (existing === undefined ? 0 : existing) + changes;
  }
};

const getContributorLanguages = async (
  owner: string,
  repo: string,
  author: string,
  token: string,
): Promise<Record<string, number>> => {
  try {
    if (token === '') {
      console.error('No token');
      return {};
    }
    const octokit = new Octokit({ auth: token });
    const langBytes: Record<string, number> = {};

    // Fetch most recent 50 commits by this author (single page, no pagination)
    const response = await octokit.rest.repos.listCommits({
      author,
      owner,
      per_page: 50,
      repo,
    });
    const commitShas = response.data.map(({ sha }) => sha);

    // Fetch commit details in batches of 5 for controlled concurrency
    for (let index = 0; index < commitShas.length; index += BATCH_SIZE) {
      const batch = commitShas.slice(index, index + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(async (sha) => processCommit(octokit, owner, repo, sha)),
      );
      for (const result of results) {
        mergeLanguageCounts(langBytes, result);
      }
    }

    return langBytes;
  } catch (error) {
    console.error('Error fetching contributor languages:', error);
    return {};
  }
};

export { getContributorLanguages, listContributors };
export type { ContributorInfo };
