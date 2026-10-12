import { Octokit } from '@octokit/rest';

import { isNotFoundError, isValidLogin, parseOwnerName } from '../validation';

interface LanguageEdge {
  size: number;
  node: { name: string };
}

interface RepoNode {
  name: string;
  isFork: boolean;
  languages: { edges: LanguageEdge[] };
}

interface PageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

interface RepositoriesConnection {
  nodes: RepoNode[];
  pageInfo: PageInfo;
}

interface GraphQLUserResponse {
  user: { repositories: RepositoriesConnection } | null;
  organization: { repositories: RepositoriesConnection } | null;
}

interface MergedResult {
  repos: string[];
  langs: Record<string, number>[];
}

const CACHE_TTL_MS = 5 * 60 * 1000;
// Bounded so that an attacker cycling through account names cannot grow the
// per-container cache without limit.
const MAX_CACHE_ENTRIES = 200;
// Each page is one GraphQL call costing many rate-limit points (100 repos x 20
// languages). Bounding the page count caps the cost of a single request for a
// huge organization (and stops a runaway loop if GitHub ever reports
// hasNextPage with no usable cursor).
const MAX_PAGES = 20;
const cache = new Map<string, { data: MergedResult; expires: number }>();

const REPOS_QUERY = `
  query($login: String!, $first: Int!, $after: String) {
    user(login: $login) {
      repositories(first: $first, after: $after, ownerAffiliations: [OWNER], privacy: PUBLIC, orderBy: {field: UPDATED_AT, direction: DESC}) {
        nodes {
          name
          isFork
          languages(first: 20, orderBy: {field: SIZE, direction: DESC}) {
            edges {
              size
              node { name }
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`;

const ORG_QUERY = `
  query($login: String!, $first: Int!, $after: String) {
    organization(login: $login) {
      repositories(first: $first, after: $after, privacy: PUBLIC, orderBy: {field: UPDATED_AT, direction: DESC}) {
        nodes {
          name
          isFork
          languages(first: 20, orderBy: {field: SIZE, direction: DESC}) {
            edges {
              size
              node { name }
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`;

const edgesToLangs = (edges: LanguageEdge[]): Record<string, number> => {
  const result: Record<string, number> = {};
  for (const edge of edges) {
    result[edge.node.name] = edge.size;
  }
  return result;
};

const getConnection = (
  response: GraphQLUserResponse,
  isOrg: boolean,
): RepositoriesConnection | undefined => {
  const source = isOrg ? response.organization : response.user;
  return source?.repositories ?? undefined;
};

const fetchAllRepos = async (
  octokit: Octokit,
  name: string,
  isOrg: boolean,
): Promise<RepoNode[]> => {
  const allNodes: RepoNode[] = [];
  const query = isOrg ? ORG_QUERY : REPOS_QUERY;
  let after: string | undefined;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    let response: GraphQLUserResponse;
    try {
      response = await octokit.graphql(query, {
        after,
        first: 100,
        login: name,
      });
    } catch (error) {
      // GitHub reports an unknown account as a GraphQL NOT_FOUND error; that
      // means "no repositories", not a server failure.
      if (isNotFoundError(error)) {
        break;
      }
      throw error;
    }
    const connection = getConnection(response, isOrg);

    if (connection === undefined) {
      break;
    }

    allNodes.push(...connection.nodes);
    after = connection.pageInfo.endCursor ?? undefined;
    if (!connection.pageInfo.hasNextPage || after === undefined) {
      break;
    }
  }

  return allNodes;
};

const cacheKey = (isOrg: boolean, name: string): string =>
  `${isOrg ? 'org' : 'user'}:${name.toLowerCase()}`;

const storeInCache = (key: string, data: MergedResult): void => {
  const now = Date.now();
  // Re-insert so Map iteration order reflects recency of the write.
  cache.delete(key);
  if (cache.size >= MAX_CACHE_ENTRIES) {
    for (const [entryKey, entry] of cache) {
      if (entry.expires <= now) {
        cache.delete(entryKey);
      }
    }
  }
  while (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next();
    if (oldest.done === true) {
      break;
    }
    cache.delete(oldest.value);
  }
  cache.set(key, { data, expires: now + CACHE_TTL_MS });
};

const fetchMerged = async (
  username: string,
  token: string,
): Promise<MergedResult> => {
  if (token === '') {
    return { langs: [], repos: [] };
  }

  const { isOrg, name } = parseOwnerName(username);
  if (!isValidLogin(name)) {
    return { langs: [], repos: [] };
  }

  // GitHub logins are case-insensitive, so normalize to stop case variants
  // from bypassing the cache.
  const key = cacheKey(isOrg, name);
  const cached = cache.get(key);
  if (cached !== undefined && cached.expires > Date.now()) {
    return cached.data;
  }

  const octokit = new Octokit({ auth: token });
  const allNodes = await fetchAllRepos(octokit, name, isOrg);
  const filtered = allNodes.filter((node) => !node.isFork);

  const repos = filtered.map((node) => node.name);
  const langs = filtered.map((node) => edgesToLangs(node.languages.edges));

  const result = { langs, repos };
  storeInCache(key, result);

  return result;
};

export { parseOwnerName } from '../validation';
export { edgesToLangs, MAX_CACHE_ENTRIES, MAX_PAGES };
export default fetchMerged;
