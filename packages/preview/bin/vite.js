#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const readFileSync = fs.readFileSync;

const workspace = process.cwd();
const vitePkgPath = require.resolve('vite/package.json', { paths: [workspace] });
const viteDir = path.dirname(vitePkgPath);
const viteBinPath = require.resolve('./bin/vite.js', { paths: [viteDir] });
const vuePluginPath = require.resolve('@vitejs/plugin-vue', { paths: [workspace] });
const jsConfigPath = path.resolve(workspace, 'vite.config.js');
const tsConfigPath = path.resolve(workspace, 'vite.config.ts');
const viteVersion = require(vitePkgPath).version;
const viteExtraCode = `
function __proxyExport(rawOptions = {}) {

  if (!rawOptions)
    rawOptions = {};

  if (!rawOptions.template)
    rawOptions.template = {};

  if (!rawOptions.template.compilerOptions)
    rawOptions.template.compilerOptions = {};

  if (!rawOptions.template.compilerOptions.nodeTransforms)
    rawOptions.template.compilerOptions.nodeTransforms = [];

  rawOptions.template.compilerOptions.nodeTransforms.push((node, ctx) => {
    if (node.type === 1) {
        const start = node.loc.start.offset;
        const end = node.loc.end.offset;
        addEvent(node, 'pointerenter', \`$volar.highlight($event.target, $.type.__file, [\${start},\${end}])\`);
        addEvent(node, 'pointerleave', '$volar.unHighlight($event.target)');
        addEvent(node, 'vnode-mounted', \`$volar.vnodeMounted($event.el, $.type.__file, [\${start},\${end}])\`);
        addEvent(node, 'vnode-unmounted', '$volar.vnodeUnmounted($event.el)');
    }
  });

  return __originalExport(rawOptions);

    function addEvent(node, name, exp) {
        node.props.push({
            type: 7,
            name: 'on',
            exp: {
                type: 4,
                content: exp,
                isStatic: false,
                constType: 0,
                loc: node.loc,
            },
            arg: {
                type: 4,
                content: name,
                isStatic: true,
                constType: 3,
                loc: node.loc,
            },
            modifiers: [],
            loc: node.loc,
        });
    }
}

const __originalExport = module.exports;
module.exports = __proxyExport;
`;

fs.readFileSync = (...args) => {
	if (args[0] === vuePluginPath) {
		return readFileSync(...args) + viteExtraCode;
	}
    if (args[0] === jsConfigPath || args[0] === tsConfigPath) {
        const configExtraContent = readFileSync(path.resolve(__dirname, 'vite', 'configExtraContent.ts'), { encoding: 'utf8' });
        return readFileSync(...args) + configExtraContent;
    }
	return readFileSync(...args);
};

if (viteVersion.startsWith('3.')) {
	import('file://' + viteBinPath);
}
else {
	require(viteBinPath);
}
