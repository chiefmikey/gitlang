const allNames = (repos) => {
  const names = [];
  for (let i = 0; i < repos.length; i += 1) {
    names.push(repos[i].name);
  }
  return names;
};

export default allNames;
