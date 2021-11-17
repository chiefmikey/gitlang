import path from 'node:path';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import sveltePreprocess from 'svelte-preprocess';

const mode = process.env.NODE_ENV || 'development';
const production = mode === 'production';

const SRC_DIR = path.join(path.resolve(), '/client/src');
const DIST_DIR = path.join(path.resolve(), '/client/public/dist');

export default {
  entry: `${SRC_DIR}/index.js`,
  resolve: {
    alias: {
      svelte: path.resolve('node_modules', 'svelte'),
    },
    extensions: ['.mjs', '.js', '.svelte'],
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
        test: /\.svelte$/,
        use: {
          loader: 'svelte-loader',
          options: {
            compilerOptions: {
              dev: !production,
            },
            emitCss: production,
            hotReload: !production,
            preprocess: sveltePreprocess(),
          },
        },
      },
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader'],
      },
      {
        test: /node_modules\/svelte\/.*\.mjs$/,
        resolve: {
          fullySpecified: false,
        },
      },
    ],
  },
  mode,
  plugins: [
    new MiniCssExtractPlugin({
      filename: '[name].css',
    }),
  ],
  devtool: production ? false : 'source-map',
  devServer: {
    hot: true,
  },
  experiments: {
    topLevelAwait: true,
  },
};
