import { Octokit } from '@octokit/rest';

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

const parseOwnerName = (input: string): { isOrg: boolean; name: string } => {
  if (input.startsWith('@')) {
    return { isOrg: false, name: input.slice(1) };
  }
  if (input.startsWith('org:') || input.startsWith('org/')) {
    return { isOrg: true, name: input.slice(4) };
  }
  return { isOrg: false, name: input };
};

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
  let after: string | undefined;
  let hasNextPage = true;

  while (hasNextPage) {
    const query = isOrg ? ORG_QUERY : REPOS_QUERY;
    const response: GraphQLUserResponse = await octokit.graphql(query, {
      after,
      first: 100,
      login: name,
    });
    const connection = getConnection(response, isOrg);

    if (connection === undefined) {
      break;
    }

    allNodes.push(...connection.nodes);
    ({ hasNextPage } = connection.pageInfo);
    after = connection.pageInfo.endCursor ?? undefined;
  }

  return allNodes;
};

const fetchMerged = async (
  username: string,
  token: string,
): Promise<MergedResult> => {
  if (token === '') {
    return { langs: [], repos: [] };
  }

  const cached = cache.get(username);
  if (cached !== undefined && cached.expires > Date.now()) {
    return cached.data;
  }

  const octokit = new Octokit({ auth: token });
  const { isOrg, name } = parseOwnerName(username);
  const allNodes = await fetchAllRepos(octokit, name, isOrg);
  const filtered = allNodes.filter((node) => !node.isFork);

  const repos = filtered.map((node) => node.name);
  const langs = filtered.map((node) => edgesToLangs(node.languages.edges));

  const result = { langs, repos };
  cache.set(username, { data: result, expires: Date.now() + CACHE_TTL_MS });

  return result;
};

export default fetchMerged;
