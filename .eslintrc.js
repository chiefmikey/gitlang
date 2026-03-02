module.exports = {
  extends: [
    'eslint:recommended',
  ],
  parser: '@babel/eslint-parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    requireConfigFile: false,
    babelOptions: {
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
        ['@babel/preset-typescript', { jsxPragma: 'h' }],
      ],
    },
  },
  env: {
    browser: true,
    node: true,
    es2022: true,
  },
  globals: {
    Record: 'readonly',
  },
  ignorePatterns: [
    '**/dist/**/*',
    '**/node_modules/**/*',
    '**/public/**/*',
    '**/*.min.js',
    '**/*.min.css',
    '**/*.map',
    '**/*.sh',
    '**/tsconfig.json',
    '**/webpack.config.ts',
    '**/*.scss',
    '**/*.css',
  ],
  rules: {
    // Mikey Pro style rules
    'prefer-const': 'warn',
    'no-unused-vars': 'warn',
    'no-console': ['warn', { allow: ['error'] }],
    'eqeqeq': 'error',
    'curly': 'error',
    'no-var': 'error',
    'prefer-arrow-callback': 'warn',
    'prefer-template': 'warn',
    'no-undef': 'error',
    'no-unreachable': 'error',
    'no-duplicate-case': 'error',
    'no-empty': 'warn',
    'no-extra-semi': 'error',
    'no-func-assign': 'error',
    'no-invalid-regexp': 'error',
    'no-irregular-whitespace': 'error',
    'no-obj-calls': 'error',
    'no-sparse-arrays': 'error',
    'no-unexpected-multiline': 'error',
    'use-isnan': 'error',
    'valid-typeof': 'error',
  },
  overrides: [
    {
      files: ['**/*.ts', '**/*.tsx'],
      rules: {
        // TypeScript handles undefined checks better than ESLint's no-undef
        'no-undef': 'off',
        'no-unused-vars': 'off',
      },
    },
    {
      files: ['**/*.svelte'],
      parser: 'svelte-eslint-parser',
      parserOptions: {
        parser: '@babel/eslint-parser',
        ecmaVersion: 2022,
        sourceType: 'module',
        requireConfigFile: false,
        babelOptions: {
          presets: [
            ['@babel/preset-env', { targets: { node: 'current' } }],
            ['@babel/preset-typescript', { jsxPragma: 'h' }],
          ],
        },
      },
      plugins: ['svelte'],
      rules: {
        'prefer-const': 'warn',
        'no-unused-vars': 'warn',
        'no-console': ['warn', { allow: ['error'] }],
        'eqeqeq': 'error',
        'curly': 'error',
        'no-var': 'error',
        'prefer-arrow-callback': 'warn',
        'prefer-template': 'warn',
      },
    },
  ],
};
