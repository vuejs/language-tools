let modulePath = '../../dist';
try { modulePath = require.resolve('../../../../../packages/vscode-typescript-vue-plugin/node_modules/typescript-vue-plugin'); } catch { } // pnpm
try { modulePath = require.resolve('../typescript-vue-plugin'); } catch { }
module.exports = require(modulePath);
