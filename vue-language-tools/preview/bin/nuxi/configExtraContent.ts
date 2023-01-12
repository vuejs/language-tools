
if (!module.exports.default)
	module.exports.default = {};

if (!module.exports.default.vue)
	module.exports.default.vue = {};

if (!module.exports.default.vue.compilerOptions)
	module.exports.default.vue.compilerOptions = {};

if (!module.exports.default.vue.compilerOptions.nodeTransforms)
	module.exports.default.vue.compilerOptions.nodeTransforms = [];

module.exports.default.vue.compilerOptions.nodeTransforms.push(
	(node, ctx) => {
		if (node.type === 1) {
			const start = node.loc.start.offset;
			const end = node.loc.end.offset;
			addEvent(node, 'pointerenter', `$event ? $volar.highlight($event.target, $.type.__file, [${start},${end}]) : undefined`);
			addEvent(node, 'pointerleave', '$event ? $volar.unHighlight($event.target) : undefined');
			addEvent(node, 'vnode-mounted', `$event ? $volar.vnodeMounted($event.el, $.type.__file, [${start},${end}]) : undefined`);
			addEvent(node, 'vnode-unmounted', '$event ? $volar.vnodeUnmounted($event.el) : undefined');
		}
	}
);

if (!module.exports.default.plugins)
	module.exports.default.plugins = [];

module.exports.default.plugins.push({ src: '{PLUGIN_PATH}', ssr: false });

function addEvent(node, name: string, exp: string) {
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
