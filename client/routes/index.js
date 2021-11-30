import allNames from './helpers/names.js';
import getSize from './helpers/size.js';
import getLanguages from './requests/languages.js';
import getRepos from './requests/repos.js';
import auth from './requests/token.js';

let token;

const langs = async (inputOwner) => {
  try {
    let owner = inputOwner;
    let names;
    if (!token) {
      token = await auth();
    }
    if (owner.includes('/')) {
      const [user, repo] = owner.split('/');
      owner = user.replaceAll(' ', '');
      names = [repo.replaceAll(' ', '')];
    } else {
      const repos = await getRepos(owner, token);
      names = allNames(repos);
    }
    const languages = await getLanguages(owner, names, token);
    const space = getSize(languages.flat());
    return { data: { names, space } };
  } catch (error) {
    console.error('Error getting langs', error);
    return error;
  }
};

export default langs;
