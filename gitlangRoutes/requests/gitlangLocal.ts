import languages from '../helpers/github/languages';
import repositories from '../helpers/github/repositories';

const gitlangLocal = {
  langs: async (owner: string, repos: string[], token?: string) => {
    try {
      const response = await languages(owner, repos, token);
      if (response && response.length > 0) {
        return JSON.stringify(response);
      }
      return JSON.stringify([]);
    } catch {
      return JSON.stringify([]);
    }
  },

  repos: async (username: string, token?: string) => {
    try {
      const response = await repositories(username, token);
      if (response && response.length > 0) {
        return JSON.stringify(response);
      }
      return JSON.stringify([]);
    } catch {
      return JSON.stringify([]);
    }
  },
};

export default gitlangLocal;
