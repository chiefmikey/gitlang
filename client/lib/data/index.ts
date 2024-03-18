import getSize from './helpers/size';
import languages from './requests/languages';
import repositories from './requests/repositories';

const data = async (username: string) => {
  try {
    window.history.pushState('', '', `/${username}`);
    let owner = username;
    let allNames: string[];
    if (username.includes('/')) {
      [owner, ...allNames] = username.split('/');
    } else {
      allNames = await repositories(username);
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
