import { MapedMode, TsMappingData, MapedRange, Mapping } from '../utils/sourceMaps';
import { createScriptGenerator } from '@volar/source-map';
import { camelize, hyphenate } from '@vue/shared';
import * as vueDom from '@vue/compiler-dom';
import { NodeTypes, transformOn } from '@vue/compiler-dom';
import type { TemplateChildNode, ElementNode, RootNode, TransformContext } from '@vue/compiler-dom';

const capabilitiesSet = {
	all: { basic: true, diagnostic: true, references: true, definitions: true, rename: true, completion: true, semanticTokens: true },
	noFormatting: { basic: true, diagnostic: true, references: true, definitions: true, rename: true, completion: true, semanticTokens: true },
	diagnosticOnly: { diagnostic: true, completion: true, },
	htmlTagOrAttr: { basic: true, diagnostic: true, references: true, definitions: true, rename: true, },
	className: { basic: true, references: true, definitions: true, rename: true, },
	slotName: { basic: true, diagnostic: true, references: true, definitions: true, },
	slotNameExport: { basic: true, diagnostic: true, references: true, definitions: true, referencesCodeLens: true },
	propRaw: { references: true, definitions: true, rename: true, },
	referencesOnly: { references: true, definitions: true, },
}

export function generate(
	html: string,
	componentNames: string[] = [],
	cssScopedClasses: string[] = [],
	htmlToTemplate?: (htmlStart: number, htmlEnd: number) => number | undefined,
	scriptSetupVars?: string[],
	withExportSlots = true,
) {
	let node: vueDom.RootNode;
	try {
		node = vueDom.compile(html, { onError: () => { } }).ast;
	}
	catch {
		return {
			textWithoutSlots: '',
			text: '',
			mappings: [],
			cssCode: '',
			cssMappings: [],
			tags: new Set<string>(),
			formatCode: '',
			formapMappings: [],
		};
	}
	const scriptGen = createScriptGenerator<TsMappingData>();
	const formatGen = createScriptGenerator<TsMappingData>();
	const inlineCssGen = createScriptGenerator<undefined>();
	const tags = new Set<string>();
	const slots = new Map<string, {
		varName: string,
		loc: MapedRange,
	}>();
	const slotExps = new Map<string, {
		varName: string,
		loc: MapedRange,
	}>();
	const componentsMap = new Map<string, string>();
	const cssScopedClassesSet = new Set(cssScopedClasses);

	for (const componentName of componentNames) {
		componentsMap.set(hyphenate(componentName), componentName);
	}

	let elementIndex = 0;

	for (const childNode of node.children) {
		scriptGen.addText(`{\n`);
		writeNode(childNode, []);
		scriptGen.addText(`}\n`);
	}

	if (withExportSlots) {
		scriptGen.addText(`export default {\n`);
		for (const [exp, slot] of slotExps) {
			scriptGen.addText(`...{} as __VLS_SlotExpMap<typeof ${exp}, typeof ${slot.varName}>,\n`);
		}
		for (const [name, slot] of slots) {
			writeObjectProperty(
				name,
				slot.loc,
				{
					vueTag: 'template',
					capabilities: capabilitiesSet.slotNameExport,
				},
			);
			scriptGen.addText(`: ${slot.varName},\n`);
		}
		scriptGen.addText(`};\n`);
	}

	return {
		text: scriptGen.getText(),
		mappings: scriptGen.getMappings(),
		formatCode: formatGen.getText(),
		formapMappings: formatGen.getMappings(),
		cssMappings: inlineCssGen.getMappings(),
		cssCode: inlineCssGen.getText(),
		tags,
	};

	function getComponentName(tagName: string) {
		return componentsMap.get(tagName) ?? tagName;
	}
	function writeNode(node: TemplateChildNode, parents: TemplateChildNode[]): void {
		if (node.type === NodeTypes.ELEMENT) {
			scriptGen.addText(`{\n`);
			{
				tags.add(getComponentName(node.tag));

				if (scriptSetupVars) {
					for (const scriptSetupVar of scriptSetupVars) {
						if (node.tag === scriptSetupVar || node.tag === hyphenate(scriptSetupVar)) {
							scriptGen.addText(scriptSetupVar + `; // ignore unused in script setup\n`);
						}
					}
				}

				writeInlineCss(node);
				writeImportSlots(node, parents);
				writeVshow(node);
				writeElReferences(node); // <el ref="foo" />
				writeProps(node);
				writeClassScopeds(node);
				writeEvents(node);
				writeOptionReferences(node);
				writeSlots(node);

				for (const childNode of node.children) {
					writeNode(childNode, parents.concat(node));
				}
			}
			scriptGen.addText('}\n');
		}
		else if (node.type === NodeTypes.TEXT_CALL) {
			// {{ var }}
			writeNode(node.content, parents.concat(node));
		}
		else if (node.type === NodeTypes.COMPOUND_EXPRESSION) {
			// {{ ... }} {{ ... }}
			for (const childNode of node.children) {
				if (typeof childNode === 'object') {
					writeNode(childNode as TemplateChildNode, parents.concat(node));
				}
			}
		}
		else if (node.type === NodeTypes.INTERPOLATION) {
			// {{ ... }}
			const context = node.loc.source.substring(2, node.loc.source.length - 2);
			let start = node.loc.start.offset + 2;

			scriptGen.addText(`{`);
			writeCode(
				context,
				{
					start: start,
					end: start + context.length,
				},
				MapedMode.Offset,
				{
					vueTag: 'template',
					capabilities: capabilitiesSet.all,
				},
				['{', '}'],
			);
			scriptGen.addText(`};\n`);
		}
		else if (node.type === NodeTypes.IF) {
			// v-if / v-else-if / v-else
			let firstIf = true;

			for (const branch of node.branches) {
				if (branch.condition) {
					if (branch.condition.type === NodeTypes.SIMPLE_EXPRESSION) {

						scriptGen.addText(firstIf ? `if (\n` : `else if (\n`);
						firstIf = false;

						scriptGen.addText(`(`);
						writeCode(
							branch.condition.content,
							{
								start: branch.condition.loc.start.offset,
								end: branch.condition.loc.end.offset,
							},
							MapedMode.Offset,
							{
								vueTag: 'template',
								capabilities: capabilitiesSet.all,
							},
							['(', ')'],
						);
						scriptGen.addText(`)\n`);
						scriptGen.addText(`) {\n`);
						for (const childNode of branch.children) {
							writeNode(childNode, parents.concat([node, branch]));
						}
						scriptGen.addText('}\n');
					}
				}
				else {
					scriptGen.addText('else {\n');
					for (const childNode of branch.children) {
						writeNode(childNode, parents.concat([node, branch]));
					}
					scriptGen.addText('}\n');
				}
			}
		}
		else if (node.type === NodeTypes.FOR) {
			// v-for
			const source = node.parseResult.source;
			const value = node.parseResult.value;
			const key = node.parseResult.key;
			const index = node.parseResult.index;

			if (value
				&& source.type === NodeTypes.SIMPLE_EXPRESSION
				&& value.type === NodeTypes.SIMPLE_EXPRESSION) {

				let start_value = value.loc.start.offset;
				let start_source = source.loc.start.offset;

				const sourceVarName = `__VLS_${elementIndex++}`;
				// const __VLS_100 = 123;
				// const __VLS_100 = vmValue;
				scriptGen.addText(`const ${sourceVarName} = __VLS_getVforSourceType(`);
				writeCode(
					source.content,
					{
						start: start_source,
						end: start_source + source.content.length,
					},
					MapedMode.Offset,
					{
						vueTag: 'template',
						capabilities: capabilitiesSet.noFormatting,
					},
				);
				scriptGen.addText(`);\n`);
				scriptGen.addText(`for (__VLS_for_key in `);
				writeCode(
					sourceVarName,
					{
						start: source.loc.start.offset,
						end: source.loc.end.offset,
					},
					MapedMode.Gate,
					{
						vueTag: 'template',
						capabilities: capabilitiesSet.diagnosticOnly,
					},
				);
				scriptGen.addText(`) {\n`);

				scriptGen.addText(`const `);
				writeCode(
					value.content,
					{
						start: start_value,
						end: start_value + value.content.length,
					},
					MapedMode.Offset,
					{
						vueTag: 'template',
						capabilities: capabilitiesSet.noFormatting,
					},
				);
				scriptGen.addText(` = ${sourceVarName}[__VLS_for_key];\n`);

				if (key && key.type === NodeTypes.SIMPLE_EXPRESSION) {
					let start_key = key.loc.start.offset;
					scriptGen.addText(`const `);
					writeCode(
						key.content,
						{
							start: start_key,
							end: start_key + key.content.length,
						},
						MapedMode.Offset,
						{
							vueTag: 'template',
							capabilities: capabilitiesSet.noFormatting,
						},
					);
					scriptGen.addText(` = __VLS_getVforKeyType(${sourceVarName});\n`);
				}
				if (index && index.type === NodeTypes.SIMPLE_EXPRESSION) {
					let start_index = index.loc.start.offset;
					scriptGen.addText(`const `);
					writeCode(
						index.content,
						{
							start: start_index,
							end: start_index + index.content.length,
						},
						MapedMode.Offset,
						{
							vueTag: 'template',
							capabilities: capabilitiesSet.noFormatting,
						},
					);
					scriptGen.addText(` = __VLS_getVforIndexType(${sourceVarName});\n`);
				}
				for (const childNode of node.children) {
					writeNode(childNode, parents.concat(node));
				}
				scriptGen.addText('}\n');
			}
		}
		else if (node.type === NodeTypes.TEXT) {
			// not needed progress
		}
		else if (node.type === NodeTypes.COMMENT) {
			// not needed progress
		}
		else {
			scriptGen.addText(`// Unprocessed node type: ${node.type} json: ${JSON.stringify(node.loc)}\n`);
		}
	};
	function writeInlineCss(node: ElementNode) {
		for (const prop of node.props) {
			if (
				prop.type === NodeTypes.DIRECTIVE
				&& prop.name === 'bind'
				&& prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION
				&& prop.exp?.type === NodeTypes.SIMPLE_EXPRESSION
				&& prop.arg.content === 'style'
				&& prop.exp.constType === vueDom.ConstantTypes.CAN_STRINGIFY
			) {
				const endCrt = prop.arg.loc.source[prop.arg.loc.source.length - 1]; // " | '
				const start = prop.arg.loc.source.indexOf(endCrt) + 1;
				const end = prop.arg.loc.source.lastIndexOf(endCrt);
				const content = prop.arg.loc.source.substring(start, end);
				const sourceRange = {
					start: prop.arg.loc.start.offset + start,
					end: prop.arg.loc.start.offset + end,
				};
				if (htmlToTemplate) {
					const newStart = htmlToTemplate(sourceRange.start, sourceRange.end);
					if (newStart === undefined) continue;
					const offset = newStart - sourceRange.start;
					sourceRange.start += offset;
					sourceRange.end += offset;
				}
				inlineCssGen.addText(`${node.tag} { `);
				inlineCssGen.addCode(
					content,
					sourceRange,
					MapedMode.Offset,
					undefined,
				);
				inlineCssGen.addText(` }\n`);
			}
		}
	}
	function writeImportSlots(node: ElementNode, parents: TemplateChildNode[]) {
		for (const prop of node.props) {
			if (
				prop.type === NodeTypes.DIRECTIVE
				&& prop.name === 'slot'
			) {
				const parent = findParentElement(parents.concat(node));
				if (!parent) continue;

				if (prop.exp?.type === NodeTypes.SIMPLE_EXPRESSION) {
					scriptGen.addText(`let `);
					writeCode(
						prop.exp.content,
						{
							start: prop.exp.loc.start.offset,
							end: prop.exp.loc.end.offset,
						},
						MapedMode.Offset,
						{
							vueTag: 'template',
							capabilities: capabilitiesSet.all,
						},
						['(', ')'],
					);
					scriptGen.addText(` = `);
				}
				let slotName = 'default';
				if (prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION && prop.arg.content !== '') {
					slotName = prop.arg.content;
				}
				const diagStart = scriptGen.getText().length;
				scriptGen.addText(`__VLS_components['${getComponentName(parent.tag)}'].__VLS_slots`);
				writePropertyAccess(
					slotName,
					{
						start: prop.arg?.loc.start.offset ?? prop.loc.start.offset,
						end: prop.arg?.loc.end.offset ?? prop.loc.end.offset,
					},
					{
						vueTag: 'template',
						capabilities: capabilitiesSet.slotName,
					},
				);
				const diagEnd = scriptGen.getText().length;
				addMapping(scriptGen, {
					targetRange: {
						start: diagStart,
						end: diagEnd,
					},
					sourceRange: {
						start: prop.arg?.loc.start.offset ?? prop.loc.start.offset,
						end: prop.arg?.loc.end.offset ?? prop.loc.end.offset,
					},
					mode: MapedMode.Gate,
					data: {
						vueTag: 'template',
						capabilities: capabilitiesSet.diagnosticOnly,
					},
				});
				scriptGen.addText(`;\n`);
			}
		}
	}
	function writeOptionReferences(node: ElementNode) {
		// fix find references not work if prop has default value
		// fix emits references not work
		for (const prop of node.props) {
			if (
				prop.type === NodeTypes.DIRECTIVE
				&& prop.arg
				&& (!prop.exp || prop.exp.type === NodeTypes.SIMPLE_EXPRESSION)
				&& prop.arg.type === NodeTypes.SIMPLE_EXPRESSION
				&& !(prop.exp?.constType === vueDom.ConstantTypes.CAN_STRINGIFY) // ignore style, style='z-index: 2' will compile to {'z-index':'2'}
			) {
				if (prop.name === 'bind' || prop.name === 'model') {
					write('props', prop.arg.content, prop.arg.loc.start.offset, prop.arg.loc.end.offset);
				}
				else if (prop.name === 'on') {
					if (prop.arg.content.startsWith('update:')) {
						write('props', prop.arg.content.substr('update:'.length), prop.arg.loc.start.offset + 'update:'.length, prop.arg.loc.end.offset, true);
					}
					else {
						write('emits', prop.arg.content, prop.arg.loc.start.offset, prop.arg.loc.end.offset);
					}
				}
			}
			else if (
				prop.type === NodeTypes.DIRECTIVE
				&& prop.name === 'model'
			) {
				write('props', 'modelValue', prop.loc.start.offset, prop.loc.start.offset + 'v-model'.length, false, false);
			}
			else if (
				prop.type === NodeTypes.ATTRIBUTE
			) {
				write('props', prop.name, prop.loc.start.offset, prop.loc.start.offset + prop.name.length);
			}
		}
		function write(option: 'props' | 'emits', propName: string, start: number, end: number, checking = false, rename = true) {
			const props = new Set<string>();
			const emits = new Set<string>();
			if (option === 'props') {
				props.add(propName);
				props.add(camelize(propName));
			}
			else if (option === 'emits') {
				emits.add(propName);
				props.add(camelize('on-' + propName));
			}
			for (const name of props.values()) {
				// __VLS_options.props
				if (!checking)
					scriptGen.addText(`// @ts-ignore\n`);
				scriptGen.addText(`__VLS_components['${getComponentName(node.tag)}'].__VLS_options.props`);
				writePropertyAccess(
					name,
					{
						start,
						end,
					},
					{
						vueTag: 'template',
						capabilities: {
							...capabilitiesSet.htmlTagOrAttr,
							basic: false,
							rename: rename,
						},
						doRename: keepHyphenateName,
					},
				);
				scriptGen.addText(`;\n`);
			}
			for (const name of emits.values()) {
				// __VLS_options.emits
				if (!checking)
					scriptGen.addText(`// @ts-ignore\n`);
				scriptGen.addText(`__VLS_components['${getComponentName(node.tag)}'].__VLS_options.emits`);
				writePropertyAccess(
					name,
					{
						start,
						end,
					},
					{
						vueTag: 'template',
						capabilities: {
							...capabilitiesSet.htmlTagOrAttr,
							basic: false,
							rename: rename,
						},
						doRename: keepHyphenateName,
					},
				);
				scriptGen.addText(`;\n`);
			}
		}
	}
	function writeVshow(node: ElementNode) {
		for (const prop of node.props) {
			if (
				prop.type === NodeTypes.DIRECTIVE
				&& !prop.arg
				&& prop.exp?.type === NodeTypes.SIMPLE_EXPRESSION
			) {
				scriptGen.addText(`(`);
				writeCode(
					prop.exp.content,
					{
						start: prop.exp.loc.start.offset,
						end: prop.exp.loc.end.offset,
					},
					MapedMode.Offset,
					{
						vueTag: 'template',
						capabilities: capabilitiesSet.all,
					},
					['(', ')'],
				);
				scriptGen.addText(`);\n`);
			}
		}
	}
	function writeElReferences(node: ElementNode) {
		for (const prop of node.props) {
			if (
				prop.type === NodeTypes.ATTRIBUTE
				&& prop.name === 'ref'
				&& prop.value
			) {
				scriptGen.addText(`// @ts-ignore\n`);
				scriptGen.addText(`(`);
				writeCode(
					prop.value.content,
					{
						start: prop.value.loc.start.offset + 1,
						end: prop.value.loc.end.offset - 1,
					},
					MapedMode.Offset,
					{
						vueTag: 'template',
						capabilities: capabilitiesSet.referencesOnly,
					},
				);
				scriptGen.addText(`);\n`);
			}
		}
	}
	function writeProps(node: ElementNode) {
		const varName = `__VLS_${elementIndex++}`;

		addStartWrap();

		for (const prop of node.props) {
			if (
				prop.type === NodeTypes.DIRECTIVE
				&& (prop.name === 'model' || prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION)
				&& (!prop.exp || prop.exp.type === NodeTypes.SIMPLE_EXPRESSION)
			) {

				const propName_1 = prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION ? prop.arg.content : 'modelValue';
				const propName_2 = hyphenate(propName_1) === propName_1 ? camelize(propName_1) : propName_1;
				const propValue = prop.exp?.content ?? 'undefined';
				const isClassOrStyleAttr = ['style', 'class'].includes(propName_2);

				if (isClassOrStyleAttr) {
					scriptGen.addText(`// @ts-ignore\n`);
				}

				if (prop.name === 'bind' || prop.name === 'model') {
					// camelize name
					const diagStart = scriptGen.getText().length;
					// `'${propName}': (${propValue})`
					if (!prop.arg) {
						writeObjectProperty(
							propName_1,
							{
								start: prop.loc.start.offset,
								end: prop.loc.start.offset + 'v-model'.length,
							},
							{
								vueTag: 'template',
								capabilities: capabilitiesSet.htmlTagOrAttr,
							},
						);
					}
					else if (prop.exp?.constType === vueDom.ConstantTypes.CAN_STRINGIFY) {
						writeObjectProperty(
							propName_2,
							{
								start: prop.arg.loc.start.offset,
								end: prop.arg.loc.start.offset + propName_1.length, // patch style attr
							},
							{
								vueTag: 'template',
								capabilities: capabilitiesSet.htmlTagOrAttr,
								doRename: keepHyphenateName,
							},
						);
					}
					else {
						writeObjectProperty(
							propName_2,
							{
								start: prop.arg.loc.start.offset,
								end: prop.arg.loc.end.offset,
							},
							{
								vueTag: 'template',
								capabilities: capabilitiesSet.htmlTagOrAttr,
								doRename: keepHyphenateName,
							},
						);
					}
					scriptGen.addText(`: (`);
					if (prop.exp && !(prop.exp.constType === vueDom.ConstantTypes.CAN_STRINGIFY)) { // style='z-index: 2' will compile to {'z-index':'2'}
						writeCode(
							propValue,
							{
								start: prop.exp.loc.start.offset,
								end: prop.exp.loc.end.offset,
							},
							MapedMode.Offset,
							{
								vueTag: 'template',
								capabilities: capabilitiesSet.all,
							},
							['(', ')'],
						);
					}
					else {
						scriptGen.addText(propValue);
					}
					scriptGen.addText(`)`);
					addMapping(scriptGen, {
						sourceRange: {
							start: prop.loc.start.offset,
							end: prop.loc.end.offset,
						},
						targetRange: {
							start: diagStart,
							end: scriptGen.getText().length,
						},
						mode: MapedMode.Gate,
						data: {
							vueTag: 'template',
							capabilities: capabilitiesSet.diagnosticOnly,
						},
					});
					scriptGen.addText(`,\n`);
					// original name
					if (prop.arg && propName_1 !== propName_2) {
						writeObjectProperty(
							propName_1,
							{
								start: prop.arg.loc.start.offset,
								end: prop.arg.loc.end.offset,
							},
							{
								vueTag: 'template',
								capabilities: capabilitiesSet.htmlTagOrAttr,
								doRename: keepHyphenateName,
							},
						);
						scriptGen.addText(`: (${propValue}),\n`);
					}
				}
			}
			else if (
				prop.type === NodeTypes.ATTRIBUTE
			) {
				const propName = hyphenate(prop.name) === prop.name ? camelize(prop.name) : prop.name;
				const propValue = prop.value !== undefined ? `\`${prop.value.content.replace(/`/g, '\\`')}\`` : 'true';
				const propName2 = prop.name;
				const isClassOrStyleAttr = ['style', 'class'].includes(propName);

				if (isClassOrStyleAttr) {
					scriptGen.addText(`// @ts-ignore\n`);
				}

				// camelize name
				const diagStart = scriptGen.getText().length;
				writeObjectProperty(
					propName,
					{
						start: prop.loc.start.offset,
						end: prop.loc.start.offset + propName2.length,
					},
					{
						vueTag: 'template',
						capabilities: capabilitiesSet.htmlTagOrAttr,
						doRename: keepHyphenateName,
					},
				);
				scriptGen.addText(`: ${propValue}`);
				addMapping(scriptGen, {
					sourceRange: {
						start: prop.loc.start.offset,
						end: prop.loc.end.offset,
					},
					targetRange: {
						start: diagStart,
						end: scriptGen.getText().length,
					},
					mode: MapedMode.Gate,
					data: {
						vueTag: 'template',
						capabilities: capabilitiesSet.diagnosticOnly,
					},
				});
				scriptGen.addText(`,\n`);
				// original name
				if (propName2 !== propName) {
					writeObjectProperty(
						propName2,
						{
							start: prop.loc.start.offset,
							end: prop.loc.start.offset + propName2.length,
						},
						{
							vueTag: 'template',
							capabilities: capabilitiesSet.htmlTagOrAttr,
							doRename: keepHyphenateName,
						},
					);
					scriptGen.addText(`: ${propValue},\n`);
				}
			}
			else {
				scriptGen.addText("/* " + [prop.type, prop.name, prop.arg?.loc.source, prop.exp?.loc.source, prop.loc.source].join(", ") + " */\n");
			}
		}

		addEndWrap();

		function addStartWrap() {
			{ // start tag
				scriptGen.addText(`__VLS_components`);
				writePropertyAccess(
					getComponentName(node.tag),
					{
						start: node.loc.start.offset + node.loc.source.indexOf(node.tag),
						end: node.loc.start.offset + node.loc.source.indexOf(node.tag) + node.tag.length,
					},
					{
						vueTag: 'template',
						capabilities: capabilitiesSet.htmlTagOrAttr,
						doRename: keepHyphenateName,
					},
				);
				scriptGen.addText(`;\n`);
			}
			if (!node.isSelfClosing && !htmlToTemplate) { // end tag
				scriptGen.addText(`__VLS_components`);
				writePropertyAccess(
					getComponentName(node.tag),
					{
						start: node.loc.start.offset + node.loc.source.lastIndexOf(node.tag),
						end: node.loc.start.offset + node.loc.source.lastIndexOf(node.tag) + node.tag.length,
					},
					{
						vueTag: 'template',
						capabilities: capabilitiesSet.htmlTagOrAttr,
						doRename: keepHyphenateName,
					},
				);
				scriptGen.addText(`;\n`);
			}

			scriptGen.addText(`const `);
			writeCode(
				varName,
				{
					start: node.loc.start.offset + node.loc.source.indexOf(node.tag),
					end: node.loc.start.offset + node.loc.source.indexOf(node.tag) + node.tag.length,
				},
				MapedMode.Gate,
				{
					vueTag: 'template',
					capabilities: capabilitiesSet.diagnosticOnly,
				},
			);
			scriptGen.addText(`: typeof __VLS_componentProps['${getComponentName(node.tag)}'] = {\n`);
		}
		function addEndWrap() {
			scriptGen.addText(`}; ${varName};\n`);
		}
	}
	function writeClassScopeds(node: ElementNode) {
		for (const prop of node.props) {
			if (
				prop.type === NodeTypes.ATTRIBUTE
				&& prop.name === 'class'
				&& prop.value
			) {
				let startOffset = prop.value.loc.start.offset + 1; // +1 is "
				let tempClassName = '';

				for (const char of (prop.value.content + ' ')) {
					if (char.trim() !== '') {
						tempClassName += char;
					}
					else {
						addClass(tempClassName, startOffset);
						startOffset += tempClassName.length + 1;
						tempClassName = '';
					}
				}

				function addClass(className: string, offset: number) {
					scriptGen.addText(`// @ts-ignore\n`);
					scriptGen.addText(`__VLS_styleScopedClasses`);
					writePropertyAccess(
						className,
						{
							start: offset,
							end: offset + className.length,
						},
						{
							vueTag: 'template',
							capabilities: {
								...capabilitiesSet.className,
								displayWithLink: cssScopedClassesSet.has(className),
							},
						},
					);
					scriptGen.addText(`;\n`);
				}
			}
		}
	}
	function writeEvents(node: ElementNode) {
		// @ts-ignore
		const context: TransformContext = {
			onError: () => { },
			helperString: str => str.toString(),
			cacheHandlers: false,
			prefixIdentifiers: false,
		};

		for (const prop of node.props) {
			if (
				prop.type === NodeTypes.DIRECTIVE
				&& prop.arg
				&& prop.exp
				&& prop.arg.type === NodeTypes.SIMPLE_EXPRESSION
				&& prop.exp.type === NodeTypes.SIMPLE_EXPRESSION
				&& prop.name === 'on'
			) {
				const var_on = `__VLS_${elementIndex++}`;
				let key_1 = prop.arg.content;
				let keyOffset = 0;

				if (prop.arg.content.startsWith('update:')) {
					keyOffset = 'update:'.length;
					key_1 = prop.arg.content.substr(keyOffset);
					scriptGen.addText(`let ${var_on}!: { '${key_1}': ($event: InstanceType<typeof __VLS_components['UsTeleport']>['$props']['${key_1}']) => void };\n`);
				}
				else {
					const key_2 = camelize('on-' + key_1);

					scriptGen.addText(`let ${var_on}!: { '${key_1}': __VLS_FirstFunction<typeof __VLS_componentProps['${getComponentName(node.tag)}'][`);
					writeCodeWithQuotes(
						key_2,
						{
							start: prop.arg.loc.start.offset,
							end: prop.arg.loc.end.offset,
						},
						{
							vueTag: 'template',
							capabilities: capabilitiesSet.htmlTagOrAttr,
						},
					);
					scriptGen.addText(`], __VLS_EmitEvent<typeof __VLS_components['${getComponentName(node.tag)}'], '${key_1}'>> };\n`);
				}

				const transformResult = transformOn(prop, node, context);
				for (const prop_2 of transformResult.props) {
					const value = prop_2.value;
					scriptGen.addText(`${var_on} = {\n`);
					writeObjectProperty(
						key_1,
						{
							start: prop.arg.loc.start.offset + keyOffset,
							end: prop.arg.loc.end.offset,
						},
						{
							vueTag: 'template',
							capabilities: capabilitiesSet.htmlTagOrAttr,
						},
					);
					scriptGen.addText(`: `);

					if (value.type === NodeTypes.SIMPLE_EXPRESSION) {
						writeCode(
							value.content,
							{
								start: value.loc.start.offset,
								end: value.loc.end.offset,
							},
							MapedMode.Offset,
							{
								vueTag: 'template',
								capabilities: capabilitiesSet.all,
							},
							['', ''],
						);
					}
					else if (value.type === NodeTypes.COMPOUND_EXPRESSION) {
						for (const child of value.children) {
							if (typeof child === 'string') {
								scriptGen.addText(child);
							}
							else if (typeof child === 'symbol') {
								// ignore
							}
							else if (child.type === NodeTypes.SIMPLE_EXPRESSION) {
								if (child.content === prop.exp.content) {
									writeCode(
										child.content,
										{
											start: child.loc.start.offset,
											end: child.loc.end.offset,
										},
										MapedMode.Offset,
										{
											vueTag: 'template',
											capabilities: capabilitiesSet.all,
										},
										['', ''],
									);
								}
								else {
									scriptGen.addText(child.content);
								}
							}
						}
					}
					scriptGen.addText(`\n};\n`);
				}
			}
		}
	}
	function writeSlots(node: ElementNode) {
		if (node.tag !== 'slot') return;
		const varDefaultBind = `__VLS_${elementIndex++}`;
		const varBinds = `__VLS_${elementIndex++}`;
		const varSlot = `__VLS_${elementIndex++}`;
		const slotName = getSlotName();
		const slotNameExp = getSlotNameExp();
		let hasDefaultBind = false;

		for (const prop of node.props) {
			if (
				prop.type === NodeTypes.DIRECTIVE
				&& !prop.arg
				&& prop.exp?.type === NodeTypes.SIMPLE_EXPRESSION
			) {
				hasDefaultBind = true;
				scriptGen.addText(`const ${varDefaultBind} = (`);
				writeCode(
					prop.exp.content,
					{
						start: prop.exp.loc.start.offset,
						end: prop.exp.loc.end.offset,
					},
					MapedMode.Offset,
					{
						vueTag: 'template',
						capabilities: capabilitiesSet.all,
					},
					['(', ')'],
				);
				scriptGen.addText(`);\n`);
				break;
			}
		}

		scriptGen.addText(`const ${varBinds} = {\n`);
		for (const prop of node.props) {
			if (
				prop.type === NodeTypes.DIRECTIVE
				&& prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION
				&& prop.exp?.type === NodeTypes.SIMPLE_EXPRESSION
			) {
				writeObjectProperty(
					prop.arg.content,
					{
						start: prop.arg.loc.start.offset,
						end: prop.arg.loc.end.offset,
					},
					{
						vueTag: 'template',
						doRename: keepHyphenateName,
						capabilities: capabilitiesSet.htmlTagOrAttr,
					},
				);
				scriptGen.addText(`: (`);
				writeCode(
					prop.exp.content,
					{
						start: prop.exp.loc.start.offset,
						end: prop.exp.loc.end.offset,
					},
					MapedMode.Offset,
					{
						vueTag: 'template',
						capabilities: capabilitiesSet.all,
					},
					['(', ')'],
				);
				scriptGen.addText(`),\n`);
			}
			else if (
				prop.type === NodeTypes.ATTRIBUTE
				&& prop.name !== 'name' // slot name
			) {
				const propValue = prop.value !== undefined ? `\`${prop.value.content.replace(/`/g, '\\`')}\`` : 'true';
				writeObjectProperty(
					prop.name,
					{
						start: prop.loc.start.offset,
						end: prop.loc.start.offset + prop.name.length
					},
					{
						vueTag: 'template',
						doRename: keepHyphenateName,
						capabilities: capabilitiesSet.htmlTagOrAttr,
					},
				);
				scriptGen.addText(`: (`);
				scriptGen.addText(propValue);
				scriptGen.addText(`),\n`);
			}
		}
		scriptGen.addText(`};\n`);

		if (hasDefaultBind) {
			scriptGen.addText(`var ${varSlot}!: typeof ${varDefaultBind} & typeof ${varBinds};\n`);
		}
		else {
			scriptGen.addText(`var ${varSlot}!: typeof ${varBinds};\n`);
		}

		if (slotName) {
			slots.set(slotName, {
				varName: varSlot,
				loc: {
					start: node.loc.start.offset + node.loc.source.indexOf(node.tag),
					end: node.loc.start.offset + node.loc.source.indexOf(node.tag) + node.tag.length,
				},
			});
		}
		else if (slotNameExp) {
			const varSlotExp = `__VLS_${elementIndex++}`;
			const varSlotExp2 = `__VLS_${elementIndex++}`;
			scriptGen.addText(`const ${varSlotExp} = ${slotNameExp};\n`);
			scriptGen.addText(`var ${varSlotExp2}!: typeof ${varSlotExp};\n`);
			slotExps.set(varSlotExp2, {
				varName: varSlot,
				loc: {
					start: node.loc.start.offset + node.loc.source.indexOf(node.tag),
					end: node.loc.start.offset + node.loc.source.indexOf(node.tag) + node.tag.length,
				},
			});
		}

		function getSlotName() {
			for (const prop2 of node.props) {
				if (prop2.name === 'name' && prop2.type === NodeTypes.ATTRIBUTE && prop2.value) {
					if (prop2.value.content === '') {
						return 'default';
					}
					else {
						return prop2.value.content;
					}
				}
			}
		}
		function getSlotNameExp() {
			for (const prop2 of node.props) {
				if (prop2.type === NodeTypes.DIRECTIVE && prop2.name === 'bind' && prop2.arg?.type === NodeTypes.SIMPLE_EXPRESSION && prop2.arg.content === 'name') {
					if (prop2.exp?.type === NodeTypes.SIMPLE_EXPRESSION) {
						return prop2.exp.content;
					}
					else {
						return `'default'`;
					}
				}
			}
		}
	}
	function writeObjectProperty(mapCode: string, sourceRange: MapedRange, data: TsMappingData) {
		if (/^[a-zA-Z_$][0-9a-zA-Z_$]*$/.test(mapCode)) {
			writeCode(mapCode, sourceRange, MapedMode.Offset, data);
		}
		else {
			writeCodeWithQuotes(mapCode, sourceRange, data);
		}
	}
	function writePropertyAccess(mapCode: string, sourceRange: MapedRange, data: TsMappingData) {
		if (/^[a-zA-Z_$][0-9a-zA-Z_$]*$/.test(mapCode)) {
			scriptGen.addText(`.`);
			return writeCode(mapCode, sourceRange, MapedMode.Offset, data);
		}
		else {
			scriptGen.addText(`[`);
			writeCodeWithQuotes(mapCode, sourceRange, data);
			scriptGen.addText(`]`);
		}
	}
	function writeCodeWithQuotes(mapCode: string, sourceRange: MapedRange, data: TsMappingData) {
		const addText = `'${mapCode}'`;
		addMapping(scriptGen, {
			sourceRange,
			targetRange: {
				start: scriptGen.getText().length + 1,
				end: scriptGen.getText().length + addText.length - 1,
			},
			mode: MapedMode.Offset,
			others: [
				{
					sourceRange,
					targetRange: {
						start: scriptGen.getText().length,
						end: scriptGen.getText().length + addText.length,
					},
					mode: MapedMode.Gate,
				}
			],
			data,
		});
		scriptGen.addText(addText);
	}
	function writeCode(mapCode: string, sourceRange: MapedRange, mode: MapedMode, data: TsMappingData, formatWrapper?: [string, string]) {
		if (formatWrapper) {
			formatGen.addText(formatWrapper[0]);
			const targetRange = formatGen.addText(mapCode);
			addMapping(formatGen, {
				targetRange,
				sourceRange,
				mode,
				data: {
					vueTag: 'template',
					capabilities: {
						formatting: true,
					},
				},
			});
			formatGen.addText(formatWrapper[1]);
			formatGen.addText(`\n;\n`);
		}
		const targetRange = scriptGen.addText(mapCode);
		addMapping(scriptGen, {
			sourceRange,
			targetRange,
			mode,
			data,
		});
	}
	function addMapping(gen: typeof scriptGen, mapping: Mapping<TsMappingData>) {
		const newMapping = { ...mapping };
		if (htmlToTemplate) {

			const templateStart = htmlToTemplate(mapping.sourceRange.start, mapping.sourceRange.end);
			if (templateStart === undefined) return; // not found
			const offset = templateStart - mapping.sourceRange.start;
			newMapping.sourceRange = {
				start: mapping.sourceRange.start + offset,
				end: mapping.sourceRange.end + offset,
			};

			if (mapping.others) {
				newMapping.others = [];
				for (const other of mapping.others) {
					let otherTemplateStart = htmlToTemplate(other.sourceRange.start, other.sourceRange.end);
					if (otherTemplateStart === undefined) continue;
					const otherOffset = otherTemplateStart - other.sourceRange.start;
					newMapping.others.push({
						...other,
						sourceRange: {
							start: other.sourceRange.start + otherOffset,
							end: other.sourceRange.end + otherOffset,
						},
					})
				}
			}
		}
		gen.addMapping2(newMapping);
	}
};

function keepHyphenateName(oldName: string, newName: string) {
	if (oldName === hyphenate(oldName)) {
		return hyphenate(newName);
	}
	return newName
}
function findParentElement(parents: (TemplateChildNode | RootNode)[]): ElementNode | undefined {
	for (const parent of parents.reverse()) {
		if (parent.type === NodeTypes.ELEMENT && parent.tag !== 'template') {
			return parent;
		}
	}
}
