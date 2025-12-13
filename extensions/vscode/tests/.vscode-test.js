const path = require('node:path');
const { defineConfig } = require('@vscode/test-cli');

module.exports = defineConfig({
  extensionDevelopmentPath: path.join(__dirname, '../'),
  workspaceFolder: path.join(__dirname, './workspace'),

  // Use a dedicated out dir for test JS files
  files: ['out/**/*.test.js'],

  // Mocha options
  mocha: {
    ui: 'tdd',
    timeout: 0,
    color: true
  }
});
