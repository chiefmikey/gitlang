const percentage = (size: number, allSizes: Record<string, number>) => {
  return Object.fromEntries(
    Object.entries(allSizes).map(([key, value]) => [key, value / size]),
  );
};

const eachSize = (languages: Record<string, number>[]) => {
  const allSizes: Record<string, number> = {};
  for (const language of languages) {
    for (const [key, value] of Object.entries(language)) {
      allSizes[key] = (allSizes[key] || 0) + value;
    }
  }
  return allSizes;
};

const totalSize = (languages: Record<string, number>[]) => {
  let size = 0;
  for (const language of languages) {
    for (const value of Object.values(language)) {
      size += value;
    }
  }
  return size;
};

const getSize = (languages: Record<string, number>[]) =>
  percentage(totalSize(languages), eachSize(languages));

export default getSize;
