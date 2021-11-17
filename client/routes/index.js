import getLanguages from './requests/languages.js';
import getRepos from './requests/repos.js';
import allNames from './helpers/names.js';
import getSize from './helpers/size.js';

const langs = async (owner) => {
  try {
    const repos = await getRepos(owner);
    const names = allNames(repos);
    const languages = await getLanguages(owner, names);
    const size = getSize(languages);
    return { data: { names, size } };
  } catch (error) {
    console.error('Error getting langs', error);
    return error;
  }
};

export default langs;
