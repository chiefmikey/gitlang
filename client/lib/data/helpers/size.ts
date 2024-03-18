const percentage = (size: number, allSizes: { [key: string]: number }) => {
  return Object.fromEntries(
    Object.entries(allSizes).map(([key, value]) => [key, value / size]),
  );
};

const eachSize = (languages: { [key: string]: number }[]) => {
  const allSizes: { [key: string]: number } = {};
  for (const language of languages) {
    for (const [key, value] of Object.entries(language)) {
      allSizes[key] = (allSizes[key] || 0) + value;
    }
  }
  return allSizes;
};

const totalSize = (languages: { [key: string]: number }[]) => {
  let size = 0;
  for (const language of languages) {
    for (const value of Object.values(language)) {
      size += value;
    }
  }
  return size;
};

const getSize = (languages: { [key: string]: number }[]) =>
  percentage(totalSize(languages), eachSize(languages));

export default getSize;
