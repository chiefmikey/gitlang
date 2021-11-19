import auth from './requests/token.js';
import getLanguages from './requests/languages.js';
import getRepos from './requests/repos.js';
import allNames from './helpers/names.js';
import getSize from './helpers/size.js';

const langs = async (owner) => {
  try {
    const token = await auth();
    const repos = await getRepos(owner, token);
    const names = allNames(repos);
    const languages = await getLanguages(owner, names, token);
    const space = getSize(languages.flat());
    return { data: { names, space } };
  } catch (error) {
    console.error('Error getting langs', error);
    return error;
  }
};

export default langs;
