/* eslint-disable no-undef */
module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: ["eslint:recommended", "google"],
  rules: {
    quotes: ["error", "double"],
    "object-curly-spacing": ["error", "always"],
    indent: ["error", 2],
    "max-len": ["error", { code: 120 }],
    "require-jsdoc": 0,
  },
  parserOptions: {
    ecmaVersion: 2020,
  },
};
