import MiniCssExtractPlugin, { loader } from 'mini-css-extract-plugin';
import path from 'node:path';
import sveltePreprocess from 'svelte-preprocess';
import { Configuration } from 'webpack';

const mode = process.env.NODE_ENV || 'development';
const production = mode === 'production';

const SRC_DIR = path.join(path.resolve(), '/client/src');
const DIST_DIR = path.join(path.resolve(), '/docs/public/dist');

const config: Configuration = {
  entry: `${SRC_DIR}/index.ts`,
  resolve: {
    alias: {
      svelte: path.resolve('node_modules', 'svelte'),
    },
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
            emitCss: production,
            hotReload: !production,
            preprocess: sveltePreprocess({
              postcss: true,
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
        test: /\.css$/,
        include: /svelte\.\d+\.css/,
        use: [loader, 'css-loader'],
      },
      {
        test: /node_modules\/svelte\/.*\.mjs$/,
        resolve: {
          fullySpecified: false,
        },
      },
    ],
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: '[name].css',
    }),
  ],
  devtool: production ? false : 'source-map',
  experiments: {
    topLevelAwait: true,
  },
};

export default config;
