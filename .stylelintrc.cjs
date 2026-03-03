module.exports = {
  extends: [
    'stylelint-config-standard',
    'stylelint-config-standard-scss',
  ],
  plugins: [
    'stylelint-scss',
  ],
  rules: {
    'at-rule-no-unknown': [
      true,
      {
        ignoreAtRules: [
          'tailwind',
          'apply',
          'variants',
          'responsive',
          'screen',
          'use',
          'mixin',
          'include',
          'function',
          'return',
          'if',
          'else',
          'each',
          'for',
          'while',
        ],
      },
    ],
    'scss/at-rule-no-unknown': [
      true,
      {
        ignoreAtRules: [
          'tailwind',
          'apply',
          'variants',
          'responsive',
          'screen',
          'use',
          'mixin',
          'include',
          'function',
          'return',
          'if',
          'else',
          'each',
          'for',
          'while',
        ],
      },
    ],
    'selector-pseudo-class-no-unknown': [
      true,
      {
        ignorePseudoClasses: ['global'],
      },
    ],
    'selector-pseudo-element-no-unknown': [
      true,
      {
        ignorePseudoElements: ['v-deep'],
      },
    ],
    'no-empty-source': null,
    'property-no-unknown': [
      true,
      {
        ignoreProperties: ['composes'],
      },
    ],
  },
  ignoreFiles: [
    '**/*.svelte',
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
  ],
};
