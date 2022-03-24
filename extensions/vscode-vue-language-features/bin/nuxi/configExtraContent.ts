
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
            node.props.push(
                {
                    type: 6,
                    name: 'data-loc',
                    value: {
                        content: '[' + node.loc.start.offset + ',' + node.loc.end.offset + ']',
                    },
                    loc: node.loc,
                },
            );
            addEvent(node, 'mouseenter', '$volar.highlight($event.target, $.type.__file, $event.target.dataset.loc)');
            addEvent(node, 'mouseleave', '$volar.unHighlight($event.target)');
            addEvent(node, 'vnode-mounted', '$event.el.dataset ? $volar.vnodeMounted($event.el, $.type.__file, $event.el.dataset.loc) : undefined');
            addEvent(node, 'vnode-unmounted', '$event.el.dataset ? $volar.vnodeUnmounted($event.el) : undefined');
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
