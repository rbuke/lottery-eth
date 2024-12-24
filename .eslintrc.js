module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: [
    '@typescript-eslint',
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:mocha/recommended'
  ],
  env: {
    node: true,
    mocha: true,
  },
  rules: {
    'no-console': 'off',
    '@typescript-eslint/no-unused-vars': ['error', { 
      'argsIgnorePattern': '^_',
      'varsIgnorePattern': '^_'
    }],
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-expressions': 'off',
    'no-undef': 'off', // TypeScript handles this
    '@typescript-eslint/no-require-imports': 'off'
  },
  ignorePatterns: [
    'typechain-types/**/*',
    'coverage/**/*',
    'cache/**/*',
    'artifacts/**/*'
  ]
}; 