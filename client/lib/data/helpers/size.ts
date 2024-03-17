const percentage = (size: number, allSizes: { [key: string]: number }) => {
  const allResults: { [key: string]: number } = {};
  const keys = Object.keys(allSizes);
  for (const key of keys) {
    allResults[key] = allSizes[key] / size;
  }
  return allResults;
};

const eachSize = (languages: { [key: string]: number }[]) => {
  const allSizes: { [key: string]: number } = {};
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

const totalSize = (languages: { [key: string]: number }[]) => {
  let size = 0;
  for (const language of languages) {
    const keys = Object.keys(language);
    for (const key of keys) {
      size += language[key];
    }
  }
  return size;
};

const getSize = (languages: { [key: string]: number }[]) =>
  percentage(totalSize(languages), eachSize(languages));

export default getSize;
