import getSize from './helpers/size';
import languages from './requests/languages';
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

const data = async (username: string) => {
  try {
    window.history.pushState('', '', `/${username}`);
    let owner = username;
    let allNames: string[];
    if (username.includes('/')) {
      [owner, ...allNames] = username.split('/');
      // Parse organization prefix for the owner part
      owner = parseOwnerName(owner);
    } else {
      allNames = await repositories(username);
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
