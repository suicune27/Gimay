/* eslint-env node */
module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
    project: './tsconfig.json',
  },
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],
  settings: {
    react: {
      version: 'detect',
    },
  },
  rules: {
    // --- TypeScript ---
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['error', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      ignoreRestSiblings: true,
    }],
    '@typescript-eslint/no-non-null-assertion': 'warn',
    '@typescript-eslint/prefer-as-const': 'error',
    '@typescript-eslint/ban-ts-comment': ['error', {
      'ts-expect-error': 'allow-with-description',
      'ts-ignore': false,
    }],
    '@typescript-eslint/no-require-imports': 'off',

    // --- React ---
    'react/prop-types': 'off', // We use TypeScript for prop validation
    'react/display-name': 'off',
    'react/no-unescaped-entities': 'off',
    'react/jsx-no-target-blank': 'error',

    // --- React Hooks ---
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',

    // --- General ---
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-unused-vars': 'off', // Handled by @typescript-eslint/no-unused-vars
    'no-duplicate-imports': 'warn',
    'prefer-const': 'error',
    'no-var': 'error',
    'eqeqeq': ['error', 'smart'],
    'no-throw-literal': 'error',
    'prefer-template': 'warn',
    'no-useless-concat': 'warn',
  },
  ignorePatterns: [
    'dist/',
    'dist_electron/',
    'node_modules/',
    '*.config.*',
    'electron/',
    'tmp-*',
  ],
  overrides: [
    // Server-side files run in Node.js
    {
      files: ['server.ts', 'api/*.ts'],
      env: {
        browser: false,
        node: true,
      },
      rules: {
        'no-console': 'off',
      },
    },
    // Test files
    {
      files: ['*.test.ts', '*.spec.ts', '**/__tests__/**'],
      rules: {
        'no-console': 'off',
      },
    },
  ],
};
