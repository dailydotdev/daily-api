module.exports = {
  parser: '@typescript-eslint/parser',
  extends: ['plugin:@typescript-eslint/recommended', 'prettier'],
  plugins: ['prettier', 'unused-imports'],
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'module',
  },
  rules: {
    'prettier/prettier': 'error',
    'unused-imports/no-unused-imports': 'error',
    'no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: 'date-fns',
            importNames: ['isWeekend'],
            message: 'Please import from src/common instead.',
          },
        ],
      },
    ],
  },
  overrides: [
    {
      files: ['migrations/*.ts', 'seeds/*.ts', 'scripts/*.ts'],
      extends: 'eslint:recommended',
      parserOptions: {
        sourceType: 'module',
      },
    },
    {
      files: ['migrations/*.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 0,
      },
    },
  ],
  env: {
    node: true,
  },
};
