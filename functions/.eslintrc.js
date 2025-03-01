module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: ["eslint:recommended", "google"],
  rules: {
    "quotes": ["error", "double"],
    "max-len": ["error", { code: 120 }],
    "indent": ["error", 2],
    "object-curly-spacing": ["error", "always"],
    "require-jsdoc": 0,
    "valid-jsdoc": 0,
    "camelcase": 0,
    "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    "linebreak-style": ["error", "windows"],
  },
  parserOptions: {
    ecmaVersion: 2020,
  },
};
