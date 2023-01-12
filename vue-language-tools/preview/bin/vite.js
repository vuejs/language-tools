#!/usr/bin/env node

const path = require('path');
const fs = require('fs');

const workspace = process.cwd();
const vitePkgPath = require.resolve('vite/package.json', { paths: [workspace] });
const viteDir = path.dirname(vitePkgPath);
const viteBinPath = require.resolve('./bin/vite.js', { paths: [viteDir] });
const vuePluginPath = require.resolve('@vitejs/plugin-vue', { paths: [workspace] });
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
        addEvent(node, 'pointerenter', \`$event ? $volar.highlight($event.target, $.type.__file, [\${start},\${end}]) : undefined\`);
        addEvent(node, 'pointerleave', '$event ? $volar.unHighlight($event.target) : undefined');
        addEvent(node, 'vnode-mounted', \`$event ? $volar.vnodeMounted($event.el, $.type.__file, [\${start},\${end}]) : undefined\`);
        addEvent(node, 'vnode-unmounted', '$event ? $volar.vnodeUnmounted($event.el) : undefined');
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

const readFileSync = fs.readFileSync;
fs.readFileSync = (...args) => {
	if (args[0] === vuePluginPath) {
		return readFileSync(...args) + viteExtraCode;
	}
	return readFileSync(...args);
};

createViteConfig();

if (Number(viteVersion.split('.')[0]) >= 3) {
	import('file://' + viteBinPath);
}
else {
	require(viteBinPath);
}

function createViteConfig() {
	let proxyConfigContent = readFileSync(path.resolve(__dirname, 'vite', 'config.ts'), { encoding: 'utf8' });
	proxyConfigContent = proxyConfigContent.replace('{CONFIG_PATH}', JSON.stringify(path.resolve(workspace, 'vite.config')));

	if (!fs.existsSync(path.resolve(workspace, 'node_modules', '.volar'))) {
		fs.mkdirSync(path.resolve(workspace, 'node_modules', '.volar'));
	}

	const proxyConfigPath = path.resolve(workspace, 'node_modules', '.volar', 'vite.config.ts');
	fs.writeFileSync(proxyConfigPath, proxyConfigContent);

	process.argv.push('--config', proxyConfigPath);
}
