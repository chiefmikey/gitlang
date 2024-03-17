import langs from './gitlang';

const handler = (input: string) => {
  return langs(input);
};

export default handler;
