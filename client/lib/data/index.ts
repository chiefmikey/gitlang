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

const data = async (username: string, options: DataOptions = {}) => {
  try {
    window.history.pushState('', '', `/${username}`);
    let owner = username;
    let allNames: string[];
    if (username.includes('/')) {
      const parts = username.split('/');
      owner = parts[0];
      // Support comma-separated repos: username/repo1,repo2,repo3
      allNames = parts
        .slice(1)
        .flatMap((part) => part.split(','))
        .filter((name) => name.length > 0);
      // Parse organization prefix for the owner part
      owner = parseOwnerName(owner);
    } else {
      allNames = await repositories(username, options.includeForks);
      // Parse organization prefix for languages API call
      owner = parseOwnerName(username);
    }
    const allLanguages = await languages(owner, allNames);
    const space = getSize(allLanguages.flat());
    return { data: { allNames, space } };
  } catch (error) {
    console.error('Error getting langs', error);
    throw error;
  }
};

export default data;
