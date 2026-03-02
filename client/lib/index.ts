import data from './data';

interface HandlerOptions {
  includeForks?: boolean;
}

const handler = async (input: string, options: HandlerOptions = {}) => {
  return data(input, options);
};

export default handler;
