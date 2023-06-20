let modulePath = '../../dist';
try { modulePath = require.resolve('../typescript-vue-plugin'); } catch { }
module.exports = require(modulePath);
