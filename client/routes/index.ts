import getSize from './helpers/size';
import languages from './requests/languages';
import repos from './requests/repos';

const langs = async (inputOwner: string) => {
  try {
    window.history.pushState('', '', `/${inputOwner}`);
    let owner = inputOwner;
    let allNames: string[];
    if (inputOwner.includes('/')) {
      const [splitOwner, splitRepo] = inputOwner.split('/');
      owner = splitOwner;
      allNames = [splitRepo];
    } else {
      allNames = await repos(inputOwner);
    }
    const allLanguages = await languages(owner, allNames);
    const space = getSize(allLanguages.flat());
    return { data: { allNames, space } };
  } catch (error) {
    console.error('Error getting langs', error);
    return error;
  }
};

export default langs;
