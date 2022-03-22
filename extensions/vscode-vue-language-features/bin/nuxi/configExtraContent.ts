
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
            const { offset: start } = node.loc.start;
            const { offset: end } = node.loc.end;
            node.props.push(
                {
                    type: 6,
                    name: 'data-loc',
                    value: {
                        content: `[${start},${end}]`,
                    },
                    loc: node.loc,
                },
                {
                    type: 7,
                    name: 'on',
                    exp: {
                        type: 4,
                        content: '$volar.highlight($event.target, $.type.__file, $event.target.dataset.loc);',
                        isStatic: false,
                        constType: 0,
                        loc: node.loc,
                    },
                    arg: {
                        type: 4,
                        content: 'mouseenter',
                        isStatic: true,
                        constType: 3,
                        loc: node.loc,
                    },
                    modifiers: [],
                    loc: node.loc,
                },
                {
                    type: 7,
                    name: 'on',
                    exp: {
                        type: 4,
                        content: '$volar.unHighlight($event.target)',
                        isStatic: false,
                        constType: 0,
                        loc: node.loc,
                    },
                    arg: {
                        type: 4,
                        content: 'mouseleave',
                        isStatic: true,
                        constType: 3,
                        loc: node.loc,
                    },
                    modifiers: [],
                    loc: node.loc,
                },
            );
        }
    }
);


if (!module.exports.default.plugins)
    module.exports.default.plugins = [];

module.exports.default.plugins.push({ src: '{PLUGIN_PATH}', ssr: false });
