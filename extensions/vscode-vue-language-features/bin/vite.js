#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const readFileSync = fs.readFileSync;

const workspace = process.cwd();
const viteBinPath = require.resolve('vite/bin/vite.js', { paths: [workspace] });
const viteDir = path.dirname(require.resolve('vite/package.json', { paths: [workspace] }));
const vuePluginPath = require.resolve('@vitejs/plugin-vue', { paths: [workspace] });
const installCode = `
function __createAppProxy(...args) {
    const app = createApp(...args);
    app.use(__installFinder);
    app.use(__installPreview);
    var href = '';
    setInterval(function () {
        if (href !== location.href) {
            href = location.href;
            parent.postMessage({ command: 'urlChanged', data: href }, '*');
        }
    }, 200);
    return app;
}
function __installFinder(app) {
    window.addEventListener('scroll', updateOverlay);
    window.addEventListener('message', function (event) {
        var _a;
        if (((_a = event.data) === null || _a === void 0 ? void 0 : _a.command) === 'selectElement') {
            enabled = true;
        }
    });
    window.addEventListener('click', function (ev) {
        if (enabled) {
            ev.preventDefault(); // TODO: not working
            enabled = false;
            highlightNodes = [];
            updateOverlay();
            if (lastGotoData) {
                parent.postMessage(lastGotoData, '*');
                lastGotoData = undefined;
            }
        }
    });
    var overlay = createOverlay();
    var highlightNodes = [];
    var enabled = false;
    var lastGotoData;
    app.config.globalProperties.$volar = {
        highlight: highlight,
        unHighlight: unHighlight,
    };
    function goToTemplate(fileName, range) {
        if (!enabled)
            return;
        lastGotoData = {
            command: 'goToTemplate',
            data: {
                fileName: fileName,
                range: JSON.parse(range),
            },
        };
        parent.postMessage(lastGotoData, '*');
    }
    function highlight(node, fileName, range) {
        if (!enabled)
            return;
        highlightNodes.push([node, fileName, range]);
        updateOverlay();
    }
    function unHighlight(node) {
        highlightNodes = highlightNodes.filter(function (hNode) { return hNode[0] !== node; });
        updateOverlay();
    }
    function createOverlay() {
        var overlay = document.createElement('div');
        overlay.style.backgroundColor = 'rgba(145, 184, 226, 0.35)';
        overlay.style.position = 'fixed';
        overlay.style.zIndex = '99999999999999';
        overlay.style.pointerEvents = 'none';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.borderRadius = '3px';
        return overlay;
    }
    function updateOverlay() {
        if (highlightNodes.length) {
            document.body.appendChild(overlay);
            var highlight_1 = highlightNodes[highlightNodes.length - 1];
            var highlightNode = highlight_1[0];
            var rect = highlightNode.getBoundingClientRect();
            overlay.style.width = ~~rect.width + 'px';
            overlay.style.height = ~~rect.height + 'px';
            overlay.style.top = ~~rect.top + 'px';
            overlay.style.left = ~~rect.left + 'px';
            goToTemplate(highlight_1[1], highlight_1[2]);
        }
        else if (overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
        }
    }
}
function __installPreview(app) {
    if (location.pathname === '/__preview') {
        var preview = defineComponent({
            setup: function () {
                window.addEventListener('message', function (event) {
                    var _a;
                    if (((_a = event.data) === null || _a === void 0 ? void 0 : _a.command) === 'updateUrl') {
                        url.value = new URL(event.data.data);
                        _file.value = url.value.hash.slice(1);
                    }
                });
                var url = ref(new URL(location.href));
                var _file = ref(url.value.hash.slice(1));
                var file = computed(function () {
                    // fix windows path for vite
                    var path = _file.value.replace(/\\\\\\\\/g, '/');
                    if (path.indexOf(':') >= 0) {
                        path = path.split(':')[1];
                    }
                    return path;
                });
                var target = computed(function () { return defineAsyncComponent(function () { return import(file.value); }); }); // TODO: responsive not working
                var props = computed(function () {
                    var _props = {};
                    url.value.searchParams.forEach(function (value, key) {
                        eval('_props[key] = ' + value);
                    });
                    return _props;
                });
                return function () { return h(Suspense, undefined, [
                    h(target.value, props.value)
                ]); };
            },
        });
        // TODO: fix preview not working is preview component is root component
        app._component.setup = preview.setup;
        app.config.warnHandler = function (msg) {
            window.parent.postMessage({
                command: 'warn',
                data: msg,
            }, '*');
            console.warn(msg);
        };
        app.config.errorHandler = function (msg) {
            window.parent.postMessage({
                command: 'error',
                data: msg,
            }, '*');
            console.error(msg);
        };
        // TODO: post emit
    }
}
`;
const replaceCode = `async function doTransform(...args) {
    const result = await __doTransformOriginal(...args);
    const createAppText = 'createApp,';
    if (args[0].indexOf('vue.js?') >= 0 && result.code && result.code.indexOf(createAppText) >= 0 && result.code.indexOf('__createAppProxy') === -1) {
        const createAppOffset = result.code.lastIndexOf(createAppText);
        result.code =
            result.code.substring(0, createAppOffset)
            + '__createAppProxy as createApp,'
            + result.code.substring(createAppOffset + createAppText.length)
            + \`${installCode}\`;
    }
    return result;
}
async function __doTransformOriginal(`;
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
      const { offset: start } = node.loc.start;
      const { offset: end } = node.loc.end;
      node.props.push({
        type: 6,
        name: 'data-loc',
        value: {
          content: '[' + start + ',' + end + ']',
        },
        loc: node.loc,
      }, {
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
      }, {
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
      });
    }
  });

  return __originalExport(rawOptions);
}

const __originalExport = module.exports;
module.exports = __proxyExport;
`;

fs.readFileSync = (...args) => {
    if (args[0] === vuePluginPath) {
        return readFileSync(...args) + viteExtraCode;
    }
    if (args[0].indexOf(viteDir) === 0) {
        let content = readFileSync(...args);
        if (content.indexOf('async function doTransform(') >= 0) {
            content = content.replace(
                `async function doTransform(`,
                replaceCode,
            );
        }
        return content;
    }
    return readFileSync(...args);
};

require(viteBinPath);
