const percentage = (size, allSizes) => {
  const allResults = {};
  const keys = Object.keys(allSizes);
  for (const key of keys) {
    allResults[key] = allSizes[key] / size;
  }
  return allResults;
};

const eachSize = (languages) => {
  const allSizes = {};
  for (const language of languages) {
    const keys = Object.keys(language);
    for (const key of keys) {
      if (allSizes[key]) {
        allSizes[key] += language[key];
      } else {
        allSizes[key] = language[key];
      }
    }
  }
  return allSizes;
};

const totalSize = (languages) => {
  let size = 0;
  for (const language of languages) {
    const keys = Object.keys(language);
    for (const key of keys) {
      size += language[key];
    }
  }
  return size;
};

const getSize = (languages) =>
  percentage(totalSize(languages), eachSize(languages));

export default getSize;
