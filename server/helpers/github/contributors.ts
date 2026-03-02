import { Octokit } from '@octokit/rest';

// Map common file extensions to language names (matching GitHub's linguist)
const EXTENSION_MAP: Record<string, string> = {
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript',
  '.js': 'JavaScript',
  '.jsx': 'JavaScript',
  '.mjs': 'JavaScript',
  '.cjs': 'JavaScript',
  '.py': 'Python',
  '.rb': 'Ruby',
  '.go': 'Go',
  '.rs': 'Rust',
  '.java': 'Java',
  '.kt': 'Kotlin',
  '.kts': 'Kotlin',
  '.swift': 'Swift',
  '.c': 'C',
  '.h': 'C',
  '.cpp': 'C++',
  '.cc': 'C++',
  '.cxx': 'C++',
  '.hpp': 'C++',
  '.cs': 'C#',
  '.php': 'PHP',
  '.html': 'HTML',
  '.htm': 'HTML',
  '.css': 'CSS',
  '.scss': 'SCSS',
  '.sass': 'SCSS',
  '.less': 'Less',
  '.vue': 'Vue',
  '.svelte': 'Svelte',
  '.dart': 'Dart',
  '.lua': 'Lua',
  '.r': 'R',
  '.R': 'R',
  '.scala': 'Scala',
  '.ex': 'Elixir',
  '.exs': 'Elixir',
  '.erl': 'Erlang',
  '.hrl': 'Erlang',
  '.hs': 'Haskell',
  '.ml': 'OCaml',
  '.mli': 'OCaml',
  '.pl': 'Perl',
  '.pm': 'Perl',
  '.sh': 'Shell',
  '.bash': 'Shell',
  '.zsh': 'Shell',
  '.fish': 'Shell',
  '.ps1': 'PowerShell',
  '.sql': 'SQL',
  '.m': 'Objective-C',
  '.mm': 'Objective-C',
  '.zig': 'Zig',
  '.nim': 'Nim',
  '.jl': 'Julia',
  '.clj': 'Clojure',
  '.cljs': 'Clojure',
  '.fs': 'F#',
  '.fsx': 'F#',
  '.tf': 'HCL',
  '.yml': 'YAML',
  '.yaml': 'YAML',
  '.json': 'JSON',
  '.xml': 'XML',
  '.toml': 'TOML',
  '.md': 'Markdown',
  '.rst': 'reStructuredText',
  '.tex': 'TeX',
  '.dockerfile': 'Dockerfile',
};

const getExtension = (filename: string): string => {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) {
    // Handle extensionless files like Dockerfile, Makefile
    const base = filename.split('/').pop()?.toLowerCase() || '';
    if (base === 'dockerfile') { return '.dockerfile'; }
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
    if (!token) {
      console.error('No token');
      return [];
    }
    const octokit = new Octokit({ auth: token });
    const contributors = await octokit.paginate(
      octokit.rest.repos.listContributors,
      { owner, repo, per_page: 100 },
      (response) =>
        response.data.map(({ login, contributions, avatar_url }) => ({
          login: login || 'unknown',
          contributions,
          avatar_url: avatar_url || '',
        })),
    );
    return contributors;
  } catch (error) {
    console.error('Error fetching contributors:', error);
    return [];
  }
};

const BATCH_SIZE = 5;

const getContributorLanguages = async (
  owner: string,
  repo: string,
  author: string,
  token: string,
): Promise<Record<string, number>> => {
  try {
    if (!token) {
      console.error('No token');
      return {};
    }
    const octokit = new Octokit({ auth: token });
    const langBytes: Record<string, number> = {};

    // Fetch most recent 50 commits by this author (single page, no pagination)
    const response = await octokit.rest.repos.listCommits({
      owner,
      repo,
      author,
      per_page: 50,
    });
    const commitShas = response.data.map(({ sha }) => sha);

    const processCommit = async (sha: string) => {
      try {
        const commit = await octokit.rest.repos.getCommit({
          owner,
          repo,
          ref: sha,
        });
        const result: Record<string, number> = {};
        if (commit.data.files) {
          for (const file of commit.data.files) {
            const ext = getExtension(file.filename);
            const lang = EXTENSION_MAP[ext];
            if (lang) {
              const changes = (file.additions || 0) + (file.deletions || 0);
              result[lang] = (result[lang] || 0) + changes;
            }
          }
        }
        return result;
      } catch {
        return {};
      }
    };

    // Fetch commit details in batches of 5 for controlled concurrency
    for (let i = 0; i < commitShas.length; i += BATCH_SIZE) {
      const batch = commitShas.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(batch.map(processCommit));
      for (const result of results) {
        for (const [lang, changes] of Object.entries(result)) {
          langBytes[lang] = (langBytes[lang] || 0) + changes;
        }
      }
    }

    return langBytes;
  } catch (error) {
    console.error('Error fetching contributor languages:', error);
    return {};
  }
};

export { listContributors, getContributorLanguages };
export type { ContributorInfo };
