import svelteConfig from '@mikey-pro/eslint-config-svelte';

// Override TypeScript parser options — mikey-pro resolves tsconfig relative
// to its own package directory, which breaks when consumed from node_modules.
// Use projectService for automatic tsconfig discovery instead.
const config = svelteConfig.map((entry) => {
  if (entry.languageOptions?.parserOptions?.project) {
    return {
      ...entry,
      languageOptions: {
        ...entry.languageOptions,
        parserOptions: {
          ...entry.languageOptions.parserOptions,
          project: true,
          tsconfigRootDir: import.meta.dirname,
        },
      },
    };
  }
  return entry;
});

// Exclude SCSS files from ESLint — they are handled by Stylelint, not ESLint.
// ESLint's JS/TS parsers cannot parse SCSS syntax.
config.push({
  ignores: ['**/*.scss', '**/*.css'],
});

// Disable import-x rules for TypeScript files — the typescript resolver plugin
// fails to load ("typescript with invalid interface loaded as resolver"), making
// all import-x/* rules produce false-positive errors. TypeScript itself handles
// module resolution for .ts files; ESLint import rules are not needed.
config.push({
  files: ['**/*.ts', '**/*.tsx'],
  rules: {
    'import-x/extensions': 'off',
    'import-x/no-cycle': 'off',
    'import-x/no-duplicates': 'off',
    'import-x/no-extraneous-dependencies': 'off',
    'import-x/no-relative-packages': 'off',
    'import-x/no-relative-parent-imports': 'off',
    'import-x/no-self-import': 'off',
    'import-x/no-unresolved': 'off',
    'import-x/no-useless-path-segments': 'off',
    'import-x/order': 'off',
    // Prettier cannot parse TypeScript generics as part of JSX/expression mode
    'prettier/prettier': 'off',
    // security/detect-possible-timing-attacks fires on token === '' checks,
    // which are simple empty-string guards, not timing-sensitive comparisons.
    'security/detect-possible-timing-attacks': 'off',
  },
});

// Disable require-atomic-updates for Koa router and Lambda handler files.
// Koa middleware assigns to ctx.response.status/body synchronously after an
// await, which is the correct Koa pattern, not a real race condition. Similarly,
// the module-level credential/token cache in auth.ts is intentional.
config.push({
  files: [
    'server/requests/gitlangRouter.ts',
    'server/lambda.ts',
    'server/helpers/github/auth.ts',
  ],
  rules: {
    'require-atomic-updates': 'off',
  },
});

export default config;
