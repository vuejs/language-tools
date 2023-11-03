import * as vue from '@vue/language-core';
import type * as ts from 'typescript/lib/tsserverlibrary';
import * as path from 'path-browserify';
import { code as typeHelpersCode } from 'vue-component-type-helpers';
import { code as vue2TypeHelpersCode } from 'vue-component-type-helpers/vue2';
import { createLanguageServiceHost, decorateLanguageService } from '@volar/typescript';

import type {
	MetaCheckerOptions,
	ComponentMeta,
	EventMeta,
	ExposeMeta,
	PropertyMeta,
	PropertyMetaSchema,
	SlotMeta,
	Declaration
} from './types';

export * from './types';

const windowsPathReg = /\\/g;

export function createCheckerByJsonBase(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	rootPath: string,
	json: any,
	checkerOptions: MetaCheckerOptions = {},
) {
	rootPath = rootPath.replace(windowsPathReg, '/');
	return createCheckerWorker(
		ts,
		() => vue.createParsedCommandLineByJson(ts, ts.sys, rootPath, json),
		checkerOptions,
		rootPath,
		path.join(rootPath, 'jsconfig.json.global.vue'),
	);
}

export function createCheckerBase(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	tsconfig: string,
	checkerOptions: MetaCheckerOptions = {},
) {
	tsconfig = tsconfig.replace(windowsPathReg, '/');
	return createCheckerWorker(
		ts,
		() => vue.createParsedCommandLine(ts, ts.sys, tsconfig),
		checkerOptions,
		path.dirname(tsconfig),
		tsconfig + '.global.vue',
	);
}

function createCheckerWorker(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	loadParsedCommandLine: () => vue.ParsedCommandLine,
	checkerOptions: MetaCheckerOptions,
	rootPath: string,
	globalComponentName: string,
) {

	/**
	 * Original Host
	 */

	let parsedCommandLine = loadParsedCommandLine();
	let fileNames = parsedCommandLine.fileNames.map(path => path.replace(windowsPathReg, '/'));
	let projectVersion = 0;

	const scriptSnapshots = new Map<string, ts.IScriptSnapshot>();
	const _host: vue.TypeScriptLanguageHost = {
		workspacePath: rootPath,
		rootPath: rootPath,
		getProjectVersion: () => projectVersion.toString(),
		getCompilationSettings: () => parsedCommandLine.options,
		getScriptFileNames: () => fileNames,
		getProjectReferences: () => parsedCommandLine.projectReferences,
		getScriptSnapshot: (fileName) => {
			if (!scriptSnapshots.has(fileName)) {
				const fileText = ts.sys.readFile(fileName);
				if (fileText !== undefined) {
					scriptSnapshots.set(fileName, ts.ScriptSnapshot.fromString(fileText));
				}
			}
			return scriptSnapshots.get(fileName);
		},
	};

	return {
		...baseCreate(ts, _host, vue.resolveVueCompilerOptions(parsedCommandLine.vueOptions), checkerOptions, globalComponentName),
		updateFile(fileName: string, text: string) {
			fileName = fileName.replace(windowsPathReg, '/');
			scriptSnapshots.set(fileName, ts.ScriptSnapshot.fromString(text));
			projectVersion++;
		},
		deleteFile(fileName: string) {
			fileName = fileName.replace(windowsPathReg, '/');
			fileNames = fileNames.filter(f => f !== fileName);
			projectVersion++;
		},
		reload() {
			parsedCommandLine = loadParsedCommandLine();
			fileNames = parsedCommandLine.fileNames.map(path => path.replace(windowsPathReg, '/'));
			this.clearCache();
		},
		clearCache() {
			scriptSnapshots.clear();
			projectVersion++;
		},
	};
}

export function baseCreate(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	_host: vue.TypeScriptLanguageHost,
	vueCompilerOptions: vue.VueCompilerOptions,
	checkerOptions: MetaCheckerOptions,
	globalComponentName: string,
) {
	const globalComponentSnapshot = ts.ScriptSnapshot.fromString('<script setup lang="ts"></script>');
	const metaSnapshots: Record<string, ts.IScriptSnapshot> = {};
	const host = new Proxy<Partial<vue.TypeScriptLanguageHost>>({
		getScriptFileNames: () => {
			const names = _host.getScriptFileNames();
			return [
				...names,
				...names.map(getMetaFileName),
				globalComponentName,
				getMetaFileName(globalComponentName),
			];
		},
		getScriptSnapshot: fileName => {
			if (isMetaFileName(fileName)) {
				if (!metaSnapshots[fileName]) {
					metaSnapshots[fileName] = ts.ScriptSnapshot.fromString(getMetaScriptContent(fileName));
				}
				return metaSnapshots[fileName];
			}
			else if (fileName === globalComponentName) {
				return globalComponentSnapshot;
			}
			else {
				return _host.getScriptSnapshot(fileName);
			}
		},
	}, {
		get(target, prop) {
			if (prop in target) {
				return target[prop as keyof typeof target];
			}
			return _host[prop as keyof typeof _host];
		},
	}) as vue.TypeScriptLanguageHost;
	const vueLanguages = vue.createLanguages(
		ts,
		host.getCompilationSettings(),
		vueCompilerOptions,
	);
	const core = vue.createLanguageContext(host, vueLanguages);
	const tsLsHost = createLanguageServiceHost(core, ts, ts.sys);
	const tsLs = ts.createLanguageService(tsLsHost);

	decorateLanguageService(core.virtualFiles, tsLs, false);

	if (checkerOptions.forceUseTs) {
		const getScriptKind = tsLsHost.getScriptKind;
		tsLsHost.getScriptKind = (fileName) => {
			if (fileName.endsWith('.vue.js')) {
				return ts.ScriptKind.TS;
			}
			if (fileName.endsWith('.vue.jsx')) {
				return ts.ScriptKind.TSX;
			}
			return getScriptKind!(fileName);
		};
	}

	let globalPropNames: string[] | undefined;

	return {
		getExportNames,
		getComponentMeta,
		__internal__: {
			tsLs,
		},
	};

	function isMetaFileName(fileName: string) {
		return fileName.endsWith('.meta.ts');
	}

	function getMetaFileName(fileName: string) {
		return (fileName.endsWith('.vue') ? fileName : fileName.substring(0, fileName.lastIndexOf('.'))) + '.meta.ts';
	}

	function getMetaScriptContent(fileName: string) {
		let code = `
import * as Components from '${fileName.substring(0, fileName.length - '.meta.ts'.length)}';
export default {} as { [K in keyof typeof Components]: ComponentMeta<typeof Components[K]>; };

interface ComponentMeta<T> {
	type: ComponentType<T>;
	props: ComponentProps<T>;
	emit: ComponentEmit<T>;
	slots: ComponentSlots<T>;
	exposed: ComponentExposed<T>;
};

${vueCompilerOptions.target < 3 ? vue2TypeHelpersCode : typeHelpersCode}
`.trim();
		return code;
	}

	function getExportNames(componentPath: string) {
		const program = tsLs.getProgram()!;
		const typeChecker = program.getTypeChecker();
		return _getExports(program, typeChecker, componentPath).exports.map(e => e.getName());
	}

	function getComponentMeta(componentPath: string, exportName = 'default'): ComponentMeta {

		const program = tsLs.getProgram()!;
		const typeChecker = program.getTypeChecker();
		const { symbolNode, exports } = _getExports(program, typeChecker, componentPath);
		const _export = exports.find((property) => property.getName() === exportName);

		if (!_export) {
			throw `Could not find export ${exportName}`;
		}

		const componentType = typeChecker.getTypeOfSymbolAtLocation(_export, symbolNode!);
		const symbolProperties = componentType.getProperties() ?? [];

		let _type: ReturnType<typeof getType> | undefined;
		let _props: ReturnType<typeof getProps> | undefined;
		let _events: ReturnType<typeof getEvents> | undefined;
		let _slots: ReturnType<typeof getSlots> | undefined;
		let _exposed: ReturnType<typeof getExposed> | undefined;

		return {
			get type() {
				return _type ?? (_type = getType());
			},
			get props() {
				return _props ?? (_props = getProps());
			},
			get events() {
				return _events ?? (_events = getEvents());
			},
			get slots() {
				return _slots ?? (_slots = getSlots());
			},
			get exposed() {
				return _exposed ?? (_exposed = getExposed());
			},
		};

		function getType() {

			const $type = symbolProperties.find(prop => prop.escapedName === 'type');

			if ($type) {
				const type = typeChecker.getTypeOfSymbolAtLocation($type, symbolNode!);
				return Number(typeChecker.typeToString(type));
			}

			return 0;
		}

		function getProps() {

			const $props = symbolProperties.find(prop => prop.escapedName === 'props');
			const propEventRegex = /^(on[A-Z])/;
			let result: PropertyMeta[] = [];

			if ($props) {
				const type = typeChecker.getTypeOfSymbolAtLocation($props, symbolNode!);
				const properties = type.getProperties();

				result = properties
					.map((prop) => {
						const {
							resolveNestedProperties,
						} = createSchemaResolvers(typeChecker, symbolNode!, checkerOptions, ts, core);

						return resolveNestedProperties(prop);
					})
					.filter((prop) => !prop.name.match(propEventRegex));
			}

			// fill global
			if (componentPath !== globalComponentName) {
				globalPropNames ??= getComponentMeta(globalComponentName).props.map(prop => prop.name);
				for (const prop of result) {
					prop.global = globalPropNames.includes(prop.name);
				}
			}

			// fill defaults
			const printer = ts.createPrinter(checkerOptions.printer);
			const snapshot = host.getScriptSnapshot(componentPath)!;

			const vueSourceFile = core.virtualFiles.getSource(componentPath)?.root;
			const vueDefaults = vueSourceFile && exportName === 'default'
				? (vueSourceFile instanceof vue.VueFile ? readVueComponentDefaultProps(vueSourceFile, printer, ts, vueCompilerOptions) : {})
				: {};
			const tsDefaults = !vueSourceFile ? readTsComponentDefaultProps(
				componentPath.substring(componentPath.lastIndexOf('.') + 1), // ts | js | tsx | jsx
				snapshot.getText(0, snapshot.getLength()),
				exportName,
				printer,
				ts,
			) : {};

			for (const [propName, defaultExp] of Object.entries({
				...vueDefaults,
				...tsDefaults,
			})) {
				const prop = result.find(p => p.name === propName);
				if (prop) {
					prop.default = defaultExp.default;

					if (defaultExp.required !== undefined) {
						prop.required = defaultExp.required;
					}

					if (prop.default !== undefined) {
						prop.required = false; // props with default are always optional
					}
				}
			}

			return result;
		}

		function getEvents() {

			const $emit = symbolProperties.find(prop => prop.escapedName === 'emit');

			if ($emit) {
				const type = typeChecker.getTypeOfSymbolAtLocation($emit, symbolNode!);
				const calls = type.getCallSignatures();

				return calls.map((call) => {

					const {
						resolveEventSignature,
					} = createSchemaResolvers(typeChecker, symbolNode!, checkerOptions, ts, core);

					return resolveEventSignature(call);
				}).filter(event => event.name);
			}

			return [];
		}

		function getSlots() {

			const $slots = symbolProperties.find(prop => prop.escapedName === 'slots');

			if ($slots) {
				const type = typeChecker.getTypeOfSymbolAtLocation($slots, symbolNode!);
				const properties = type.getProperties();

				return properties.map((prop) => {
					const {
						resolveSlotProperties,
					} = createSchemaResolvers(typeChecker, symbolNode!, checkerOptions, ts, core);

					return resolveSlotProperties(prop);
				});
			}

			return [];
		}

		function getExposed() {

			const $exposed = symbolProperties.find(prop => prop.escapedName === 'exposed');

			if ($exposed) {
				const type = typeChecker.getTypeOfSymbolAtLocation($exposed, symbolNode!);
				const properties = type.getProperties().filter(prop =>
					// only exposed props will not have a valueDeclaration
					!(prop as any).valueDeclaration
				);

				return properties.map((prop) => {
					const {
						resolveExposedProperties,
					} = createSchemaResolvers(typeChecker, symbolNode!, checkerOptions, ts, core);

					return resolveExposedProperties(prop);
				});
			}

			return [];
		}
	}

	function _getExports(
		program: ts.Program,
		typeChecker: ts.TypeChecker,
		componentPath: string,
	) {

		const sourceFile = program?.getSourceFile(getMetaFileName(componentPath));
		if (!sourceFile) {
			throw 'Could not find main source file';
		}

		const moduleSymbol = typeChecker.getSymbolAtLocation(sourceFile);
		if (!moduleSymbol) {
			throw 'Could not find module symbol';
		}

		const exportedSymbols = typeChecker.getExportsOfModule(moduleSymbol);

		let symbolNode: ts.Expression | undefined;

		for (const symbol of exportedSymbols) {

			const [declaration] = symbol.getDeclarations() ?? [];

			if (ts.isExportAssignment(declaration)) {
				symbolNode = declaration.expression;
			}
		}

		if (!symbolNode) {
			throw 'Could not find symbol node';
		}

		const exportDefaultType = typeChecker.getTypeAtLocation(symbolNode);
		const exports = exportDefaultType.getProperties();

		return {
			symbolNode,
			exports,
		};
	}
}


function createSchemaResolvers(
	typeChecker: ts.TypeChecker,
	symbolNode: ts.Expression,
	{ rawType, schema: options, noDeclarations }: MetaCheckerOptions,
	ts: typeof import('typescript/lib/tsserverlibrary'),
	core: vue.LanguageContext,
) {
	const visited = new Set<ts.Type>();

	function shouldIgnore(subtype: ts.Type) {
		const name = typeChecker.typeToString(subtype);
		if (name === 'any') {
			return true;
		}

		if (visited.has(subtype)) {
			return true;
		}

		if (typeof options === 'object') {
			for (const item of options.ignore ?? []) {
				if (typeof item === 'function') {
					const result = item(name, subtype, typeChecker);
					if (typeof result === 'boolean')
						return result;
				}
				else if (name === item) {
					return true;
				}
			}
		}

		return false;
	}

	function reducer(acc: any, cur: any) {
		acc[cur.name] = cur;
		return acc;
	}

	function resolveNestedProperties(prop: ts.Symbol): PropertyMeta {
		const subtype = typeChecker.getTypeOfSymbolAtLocation(prop, symbolNode!);
		let schema: PropertyMetaSchema;
		let declarations: Declaration[];

		return {
			name: prop.getEscapedName().toString(),
			global: false,
			description: ts.displayPartsToString(prop.getDocumentationComment(typeChecker)),
			tags: prop.getJsDocTags(typeChecker).map(tag => ({
				name: tag.name,
				text: tag.text !== undefined ? ts.displayPartsToString(tag.text) : undefined,
			})),
			required: !(prop.flags & ts.SymbolFlags.Optional),
			type: typeChecker.typeToString(subtype),
			rawType: rawType ? subtype : undefined,
			get declarations() {
				return declarations ??= getDeclarations(prop.declarations ?? []);
			},
			get schema() {
				return schema ??= resolveSchema(subtype);
			},
		};
	}
	function resolveSlotProperties(prop: ts.Symbol): SlotMeta {
		const propType = typeChecker.getNonNullableType(typeChecker.getTypeOfSymbolAtLocation(prop, symbolNode!));
		const signatures = propType.getCallSignatures();
		const paramType = signatures[0].parameters[0];
		const subtype = typeChecker.getTypeOfSymbolAtLocation(paramType, symbolNode!);
		let schema: PropertyMetaSchema;
		let declarations: Declaration[];

		return {
			name: prop.getName(),
			type: typeChecker.typeToString(subtype),
			rawType: rawType ? subtype : undefined,
			description: ts.displayPartsToString(prop.getDocumentationComment(typeChecker)),
			get declarations() {
				return declarations ??= getDeclarations(prop.declarations ?? []);
			},
			get schema() {
				return schema ??= resolveSchema(subtype);
			},
		};
	}
	function resolveExposedProperties(expose: ts.Symbol): ExposeMeta {
		const subtype = typeChecker.getTypeOfSymbolAtLocation(expose, symbolNode!);
		let schema: PropertyMetaSchema;
		let declarations: Declaration[];

		return {
			name: expose.getName(),
			type: typeChecker.typeToString(subtype),
			rawType: rawType ? subtype : undefined,
			description: ts.displayPartsToString(expose.getDocumentationComment(typeChecker)),
			get declarations() {
				return declarations ??= getDeclarations(expose.declarations ?? []);
			},
			get schema() {
				return schema ??= resolveSchema(subtype);
			},
		};
	}
	function resolveEventSignature(call: ts.Signature): EventMeta {
		const subtype = typeChecker.getTypeOfSymbolAtLocation(call.parameters[1], symbolNode!);
		let schema: PropertyMetaSchema[];
		let declarations: Declaration[];

		return {
			name: (typeChecker.getTypeOfSymbolAtLocation(call.parameters[0], symbolNode!) as ts.StringLiteralType).value,
			type: typeChecker.typeToString(subtype),
			rawType: rawType ? subtype : undefined,
			signature: typeChecker.signatureToString(call),
			get declarations() {
				return declarations ??= call.declaration ? getDeclarations([call.declaration]) : [];
			},
			get schema() {
				return schema ??= typeChecker.getTypeArguments(subtype as ts.TypeReference).map(resolveSchema);
			},
		};
	}
	function resolveCallbackSchema(signature: ts.Signature): PropertyMetaSchema {
		let schema: PropertyMetaSchema[] | undefined;

		return {
			kind: 'event',
			type: typeChecker.signatureToString(signature),
			get schema() {
				return schema ??= signature.parameters.length > 0
					? typeChecker
						.getTypeArguments(typeChecker.getTypeOfSymbolAtLocation(signature.parameters[0], symbolNode) as ts.TypeReference)
						.map(resolveSchema)
					: undefined;
			},
		};
	}
	function resolveSchema(subtype: ts.Type): PropertyMetaSchema {
		const type = typeChecker.typeToString(subtype);

		if (shouldIgnore(subtype)) {
			return type;
		}

		visited.add(subtype);

		if (subtype.isUnion()) {
			let schema: PropertyMetaSchema[];
			return {
				kind: 'enum',
				type,
				get schema() {
					return schema ??= subtype.types.map(resolveSchema);
				},
			};
		}

		// @ts-ignore - typescript internal, isArrayLikeType exists
		else if (typeChecker.isArrayLikeType(subtype)) {
			let schema: PropertyMetaSchema[];
			return {
				kind: 'array',
				type,
				get schema() {
					return schema ??= typeChecker.getTypeArguments(subtype as ts.TypeReference).map(resolveSchema);
				},
			};
		}

		else if (
			subtype.getCallSignatures().length === 0 &&
			(subtype.isClassOrInterface() || subtype.isIntersection() || (subtype as ts.ObjectType).objectFlags & ts.ObjectFlags.Anonymous)
		) {
			let schema: Record<string, PropertyMeta>;
			return {
				kind: 'object',
				type,
				get schema() {
					return schema ??= subtype.getProperties().map(resolveNestedProperties).reduce(reducer, {});
				},
			};
		}

		else if (subtype.getCallSignatures().length === 1) {
			return resolveCallbackSchema(subtype.getCallSignatures()[0]);
		}

		return type;
	}
	function getDeclarations(declaration: ts.Declaration[]): Declaration[] {
		if (noDeclarations) {
			return [];
		}
		return declaration.map(getDeclaration).filter(d => !!d) as Declaration[];
	}
	function getDeclaration(declaration: ts.Declaration): Declaration | undefined {
		const fileName = declaration.getSourceFile().fileName;
		const [virtualFile] = core.virtualFiles.getVirtualFile(fileName);
		if (virtualFile) {
			const maps = core.virtualFiles.getMaps(virtualFile);
			for (const [source, [_, map]] of maps) {
				const start = map.toSourceOffset(declaration.getStart());
				const end = map.toSourceOffset(declaration.getEnd());
				if (start && end) {
					return {
						file: source,
						range: [start[0], end[0]],
					};
				};
			}
			return undefined;
		}
		return {
			file: declaration.getSourceFile().fileName,
			range: [declaration.getStart(), declaration.getEnd()],
		};
	}

	return {
		resolveNestedProperties,
		resolveSlotProperties,
		resolveEventSignature,
		resolveExposedProperties,
		resolveSchema,
	};
}

function readVueComponentDefaultProps(
	vueSourceFile: vue.VueFile,
	printer: ts.Printer | undefined,
	ts: typeof import('typescript/lib/tsserverlibrary'),
	vueCompilerOptions: vue.VueCompilerOptions,
) {
	let result: Record<string, { default?: string, required?: boolean; }> = {};

	scriptSetupWorker();
	scriptWorker();

	return result;

	function scriptSetupWorker() {

		const descriptor = vueSourceFile.sfc;
		const scriptSetupRanges = descriptor.scriptSetup ? vue.parseScriptSetupRanges(ts, descriptor.scriptSetup.ast, vueCompilerOptions) : undefined;

		if (descriptor.scriptSetup && scriptSetupRanges?.props.withDefaults?.arg) {

			const defaultsText = descriptor.scriptSetup.content.substring(scriptSetupRanges.props.withDefaults.arg.start, scriptSetupRanges.props.withDefaults.arg.end);
			const ast = ts.createSourceFile('/tmp.' + descriptor.scriptSetup.lang, '(' + defaultsText + ')', ts.ScriptTarget.Latest);
			const obj = findObjectLiteralExpression(ast);

			if (obj) {
				for (const prop of obj.properties) {
					if (ts.isPropertyAssignment(prop)) {
						const name = prop.name.getText(ast);
						const expNode = resolveDefaultOptionExpression(prop.initializer, ts);
						const expText = printer?.printNode(ts.EmitHint.Expression, expNode, ast) ?? expNode.getText(ast);

						result[name] = {
							default: expText,
						};
					}
				}
			}
		} else if (descriptor.scriptSetup && scriptSetupRanges?.props.define?.arg) {
			const defaultsText = descriptor.scriptSetup.content.substring(scriptSetupRanges.props.define.arg.start, scriptSetupRanges.props.define.arg.end);
			const ast = ts.createSourceFile('/tmp.' + descriptor.scriptSetup.lang, '(' + defaultsText + ')', ts.ScriptTarget.Latest);
			const obj = findObjectLiteralExpression(ast);

			if (obj) {
				result = {
					...result,
					...resolvePropsOption(ast, obj, printer, ts),
				};
			}
		}

		function findObjectLiteralExpression(node: ts.Node) {
			if (ts.isObjectLiteralExpression(node)) {
				return node;
			}
			let result: ts.ObjectLiteralExpression | undefined;
			node.forEachChild(child => {
				if (!result) {
					result = findObjectLiteralExpression(child);
				}
			});
			return result;
		}
	}

	function scriptWorker() {

		const descriptor = vueSourceFile.sfc;

		if (descriptor.script) {
			const scriptResult = readTsComponentDefaultProps(descriptor.script.lang, descriptor.script.content, 'default', printer, ts);
			for (const [key, value] of Object.entries(scriptResult)) {
				result[key] = value;
			}
		}
	}
}

function readTsComponentDefaultProps(
	lang: string,
	tsFileText: string,
	exportName: string,
	printer: ts.Printer | undefined,
	ts: typeof import('typescript/lib/tsserverlibrary'),
) {

	const ast = ts.createSourceFile('/tmp.' + lang, tsFileText, ts.ScriptTarget.Latest);
	const props = getPropsNode();

	if (props) {
		return resolvePropsOption(ast, props, printer, ts);
	}

	return {};

	function getComponentNode() {

		let result: ts.Node | undefined;

		if (exportName === 'default') {
			ast.forEachChild(child => {
				if (ts.isExportAssignment(child)) {
					result = child.expression;
				}
			});
		}
		else {
			ast.forEachChild(child => {
				if (
					ts.isVariableStatement(child)
					&& child.modifiers?.some(mod => mod.kind === ts.SyntaxKind.ExportKeyword)
				) {
					for (const dec of child.declarationList.declarations) {
						if (dec.name.getText(ast) === exportName) {
							result = dec.initializer;
						}
					}
				}
			});
		}

		return result;
	}

	function getComponentOptionsNode() {

		const component = getComponentNode();

		if (component) {

			// export default { ... }
			if (ts.isObjectLiteralExpression(component)) {
				return component;
			}
			// export default defineComponent({ ... })
			// export default Vue.extend({ ... })
			else if (ts.isCallExpression(component)) {
				if (component.arguments.length) {
					const arg = component.arguments[0];
					if (ts.isObjectLiteralExpression(arg)) {
						return arg;
					}
				}
			}
		}
	}

	function getPropsNode() {
		const options = getComponentOptionsNode();
		const props = options?.properties.find(prop => prop.name?.getText(ast) === 'props');
		if (props && ts.isPropertyAssignment(props)) {
			if (ts.isObjectLiteralExpression(props.initializer)) {
				return props.initializer;
			}
		}
	}
}

function resolvePropsOption(
	ast: ts.SourceFile,
	props: ts.ObjectLiteralExpression,
	printer: ts.Printer | undefined,
	ts: typeof import('typescript/lib/tsserverlibrary'),
) {

	const result: Record<string, { default?: string, required?: boolean; }> = {};

	for (const prop of props.properties) {
		if (ts.isPropertyAssignment(prop)) {
			const name = prop.name?.getText(ast);
			if (ts.isObjectLiteralExpression(prop.initializer)) {

				const defaultProp = prop.initializer.properties.find(p => ts.isPropertyAssignment(p) && p.name.getText(ast) === 'default') as ts.PropertyAssignment | undefined;
				const requiredProp = prop.initializer.properties.find(p => ts.isPropertyAssignment(p) && p.name.getText(ast) === 'required') as ts.PropertyAssignment | undefined;

				result[name] = {};

				if (requiredProp) {
					const exp = requiredProp.initializer.getText(ast);
					result[name].required = exp === 'true';
				}
				if (defaultProp) {
					const expNode = resolveDefaultOptionExpression((defaultProp as any).initializer, ts);
					const expText = printer?.printNode(ts.EmitHint.Expression, expNode, ast) ?? expNode.getText(ast);
					result[name].default = expText;
				}
			}
		}
	}

	return result;
}

function resolveDefaultOptionExpression(
	_default: ts.Expression,
	ts: typeof import('typescript/lib/tsserverlibrary'),
) {
	if (ts.isArrowFunction(_default)) {
		if (ts.isBlock(_default.body)) {
			return _default; // TODO
		}
		else if (ts.isParenthesizedExpression(_default.body)) {
			return _default.body.expression;
		}
		else {
			return _default.body;
		}
	}
	return _default;
}
