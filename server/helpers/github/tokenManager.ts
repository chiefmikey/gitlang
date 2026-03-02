import auth from './auth';

const getToken = async (): Promise<string> => {
  return auth();
};

export { getToken };
