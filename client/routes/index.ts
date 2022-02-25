import names from './helpers/names';
import getSize from './helpers/size';
import languages from './requests/languages';
import repos from './requests/repos';

const langs = async (inputOwner: string) => {
  try {
    let owner = inputOwner;
    let allNames: string[];
    if (owner.includes('/')) {
      const [user, repo] = owner.split('/');
      owner = user.replaceAll(' ', '');
      allNames = [repo.replaceAll(' ', '')];
    } else {
      const allRepos: { name: string }[] = await repos(owner);
      allNames = names(allRepos);
    }
    const allLanguages = await languages(owner, allNames);
    const space = getSize(allLanguages.flat() as { [key: string]: number }[]);
    window.history.pushState('', '', `/${inputOwner}`);
    return { data: { allNames, space } };
  } catch (error) {
    console.error('Error getting langs', error);
    return error;
  }
};

export default langs;
