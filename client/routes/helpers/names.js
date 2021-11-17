const allNames = (repos) => {
  const names = [];
  for (const repo of repos) {
    names.push(repo.name);
  }
  return names;
};

export default allNames;
