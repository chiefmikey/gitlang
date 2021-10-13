import path from 'path';

const SRC_DIR = path.join(path.resolve(), '/client/src');
const DIST_DIR = path.join(path.resolve(), '/client/public/dist');

export default {
  mode: 'development',
  entry: `${SRC_DIR}/index.js`,
  output: {
    filename: 'bundle.js',
    path: DIST_DIR,
  },
  module: {
    rules: [
      {
        test: /\.(html|svelte)$/,
        use: 'svelte-loader',
      },
      {
        test: /node_modules\/svelte\/.*\.mjs$/,
        resolve: {
          fullySpecified: false,
        },
      },
      {
        test: /\.js?/,
        exclude: /node_modules/,
        loader: 'babel-loader',
        options: {
          presets: [
            [
              '@babel/preset-env',
              {
                targets: {
                  node: 'current',
                },
              },
            ],
          ],
        },
      },
      {
        test: /\.css$/,
        loader: 'css-loader',
      },
      {
        test: /\.(png|ttf|jp(e*)g|svg)$/,
        use: [
          {
            loader: 'url-loader',
            options: { limit: '100000&name=img/[name].[ext]' },
          },
        ],
      },
    ],
  },
  resolve: {
    extensions: ['.js', '.mjs', '.cjs', '.tsx', '.ts', '.svelte'],
    alias: {
      svelte: path.resolve('node_modules', 'svelte'),
    },
    mainFields: ['svelte', 'browser', 'module', 'main'],
  },
  devtool: 'inline-source-map',
};
