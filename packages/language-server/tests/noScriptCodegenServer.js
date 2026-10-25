// The language server without script code generation plugins, as a Vue content mapper other than vue-tsx runs.
require('../lib/server').startServer(require('typescript'), { createPlugins: () => [] });
