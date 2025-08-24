import path from 'node:path';

import sveltePreprocess from 'svelte-preprocess';
import type { Configuration } from 'webpack';

const mode = process.env.NODE_ENV as
  | 'development'
  | 'none'
  | 'production'
  | undefined;
const production = mode === 'production';

const SRC_DIR = path.join(path.resolve(), '/client/src');
const DIST_DIR = path.join(path.resolve(), '/public/dist');

const configuration: Configuration = {
  entry: `${SRC_DIR}/index.ts`,
  resolve: {
    fullySpecified: false,
    extensions: ['.mjs', '.js', '.svelte', '.ts', '.tsx'],
    mainFields: ['svelte', 'browser', 'module', 'main', 'index'],
  },
  output: {
    filename: 'bundle.js',
    path: DIST_DIR,
    chunkFilename: '[name].[id].js',
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx|ts|tsx)$/,
        exclude: /node_modules/,
        use: [
          {
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
                ['@babel/preset-typescript', { jsxPragma: 'h' }],
              ],
            },
          },
        ],
      },
      {
        test: /\.(html|svelte)$/,
        use: {
          loader: 'svelte-loader',
          options: {
            compilerOptions: {
              dev: !production,
            },
            // emitCss: production,
            hotReload: !production,
            preprocess: sveltePreprocess({
              postcss: true,
              scss: {
                includePaths: ['src'],
              },
            }),
          },
        },
      },
      {
        test: /\.css$/,
        exclude: /svelte\.\d+\.css/,
        use: ['style-loader', 'css-loader', 'postcss-loader'],
      },
      {
        test: /\.s[ac]ss$/i,
        use: ['style-loader', 'css-loader', 'sass-loader'],
      },
    ],
  },
  mode: production ? 'production' : 'development',
  devtool: production ? false : 'source-map',
  experiments: {
    topLevelAwait: true,
  },
};

export default configuration;
