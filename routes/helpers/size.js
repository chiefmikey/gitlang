const percentage = (size, allSizes) => {
  const allResults = {};
  const keys = Object.keys(allSizes);
  for (let i = 0; i < keys.length; i += 1) {
    allResults[keys[i]] = allSizes[keys[i]] / size;
  }
  return allResults;
};

const eachSize = (languages) => {
  const allSizes = {};
  for (let i = 0; i < languages.length; i += 1) {
    const keys = Object.keys(languages[i]);
    for (let j = 0; j < keys.length; j += 1) {
      if (allSizes[keys[j]]) {
        allSizes[keys[j]] += languages[i][keys[j]];
      } else {
        allSizes[keys[j]] = languages[i][keys[j]];
      }
    }
  }
  return allSizes;
};

const totalSize = (languages) => {
  let size = 0;
  for (let i = 0; i < languages.length; i += 1) {
    const keys = Object.keys(languages[i]);
    for (let j = 0; j < keys.length; j += 1) {
      size += languages[i][keys[j]];
    }
  }
  return size;
};

const getSize = (languages) =>
  percentage(totalSize(languages), eachSize(languages));

export default getSize;
