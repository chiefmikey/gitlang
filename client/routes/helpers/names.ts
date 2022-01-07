const allNames = (repos: [{ name: string }]) => {
  const names = [];
  if (repos.length > 0) {
    for (const repo of repos) {
      names.push(repo.name);
    }
  }
  return names;
};

export default allNames;
