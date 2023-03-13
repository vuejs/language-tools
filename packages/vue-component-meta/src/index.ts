import * as vue from '@volar/vue-language-core';
import * as embedded from '@volar/language-core';
import type * as ts from 'typescript/lib/tsserverlibrary';
import * as path from 'typesafe-path/posix';

import type {
	MetaCheckerOptions,
	ComponentMeta,
	EventMeta,
	ExposeMeta,
	PropertyMeta,
	PropertyMetaSchema,
	SlotMeta
} from './types';

export * from './types';

const extraFileExtensions: ts.FileExtensionInfo[] = [{
	extension: 'vue',
	isMixedContent: true,
	scriptKind: 7 /* ts.ScriptKind.Deferred */,
}];

export type ComponentMetaChecker = ReturnType<typeof baseCreate>;

export function createComponentMetaCheckerByJsonConfig(
	root: string,
	json: any,
	checkerOptions: MetaCheckerOptions = {},
	ts: typeof import('typescript/lib/tsserverlibrary') = require('typescript'),
) {
	return createComponentMetaCheckerWorker(
		() => vue.createParsedCommandLineByJson(ts, ts.sys, root, json, extraFileExtensions),
		checkerOptions,
		path.join((root as path.OsPath).replace(/\\/g, '/') as path.PosixPath, 'jsconfig.json.global.vue' as path.PosixPath),
		ts,
	);
}

export function createComponentMetaChecker(
	tsconfigPath: string,
	checkerOptions: MetaCheckerOptions = {},
	ts: typeof import('typescript/lib/tsserverlibrary') = require('typescript'),
) {
	return createComponentMetaCheckerWorker(
		() => vue.createParsedCommandLine(ts, ts.sys, tsconfigPath, extraFileExtensions),
		checkerOptions,
		(tsconfigPath as path.OsPath).replace(/\\/g, '/') as path.PosixPath + '.global.vue',
		ts,
	);
}

function createComponentMetaCheckerWorker(
	loadParsedCommandLine: () => vue.ParsedCommandLine,
	checkerOptions: MetaCheckerOptions,
	globalComponentName: string,
	ts: typeof import('typescript/lib/tsserverlibrary'),
) {

	/**
	 * Original Host
	 */

	let parsedCommandLine = loadParsedCommandLine();
	let fileNames = (parsedCommandLine.fileNames as path.OsPath[]).map<path.PosixPath>(path => path.replace(/\\/g, '/') as path.PosixPath);
	let projectVersion = 0;

	const scriptSnapshots = new Map<string, ts.IScriptSnapshot>();
	const scriptVersions = new Map<string, number>();
	const _host: vue.VueLanguageServiceHost = {
		...ts.sys,
		getProjectVersion: () => projectVersion.toString(),
		getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options), // should use ts.getDefaultLibFilePath not ts.getDefaultLibFileName
		useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames,
		getCompilationSettings: () => parsedCommandLine.options,
		getScriptFileNames: () => fileNames,
		getProjectReferences: () => parsedCommandLine.projectReferences,
		getScriptVersion: (fileName) => scriptVersions.get(fileName)?.toString() ?? '',
		getScriptSnapshot: (fileName) => {
			if (!scriptSnapshots.has(fileName)) {
				const fileText = ts.sys.readFile(fileName);
				if (fileText !== undefined) {
					scriptSnapshots.set(fileName, ts.ScriptSnapshot.fromString(fileText));
				}
			}
			return scriptSnapshots.get(fileName);
		},
		getTypeScriptModule: () => ts,
		getVueCompilationSettings: () => parsedCommandLine.vueOptions,
	};

	return {
		...baseCreate(_host, checkerOptions, globalComponentName, ts),
		updateFile(fileName: string, text: string) {
			fileName = (fileName as path.OsPath).replace(/\\/g, '/') as path.PosixPath;
			scriptSnapshots.set(fileName, ts.ScriptSnapshot.fromString(text));
			scriptVersions.set(fileName, scriptVersions.has(fileName) ? scriptVersions.get(fileName)! + 1 : 1);
			projectVersion++;
		},
		deleteFile(fileName: string) {
			fileName = (fileName as path.OsPath).replace(/\\/g, '/') as path.PosixPath;
			fileNames = fileNames.filter(f => f !== fileName);
			projectVersion++;
		},
		reload() {
			parsedCommandLine = loadParsedCommandLine();
			fileNames = (parsedCommandLine.fileNames as path.OsPath[]).map<path.PosixPath>(path => path.replace(/\\/g, '/') as path.PosixPath);
			this.clearCache();
		},
		clearCache() {
			scriptSnapshots.clear();
			scriptVersions.clear();
			projectVersion++;
		},
	};
}

export function baseCreate(
	_host: vue.VueLanguageServiceHost,
	checkerOptions: MetaCheckerOptions,
	globalComponentName: string,
	ts: typeof import('typescript/lib/tsserverlibrary'),
) {
	const globalComponentSnapshot = ts.ScriptSnapshot.fromString('<script setup lang="ts"></script>');
	const metaSnapshots: Record<string, ts.IScriptSnapshot> = {};
	const host = new Proxy<Partial<vue.VueLanguageServiceHost>>({
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
	}) as vue.VueLanguageServiceHost;
	const vueCompilerOptions = vue.resolveVueCompilerOptions(host.getVueCompilationSettings());
	const vueLanguageModules = ts ? vue.createLanguageModules(
		ts,
		host.getCompilationSettings(),
		vueCompilerOptions,
	) : [];
	const core = embedded.createLanguageContext(host, vueLanguageModules);
	const proxyApis: Partial<ts.LanguageServiceHost> = checkerOptions.forceUseTs ? {
		getScriptKind: (fileName) => {
			if (fileName.endsWith('.vue.js')) {
				return ts.ScriptKind.TS;
			}
			if (fileName.endsWith('.vue.jsx')) {
				return ts.ScriptKind.TSX;
			}
			return core.typescript.languageServiceHost.getScriptKind!(fileName);
		},
	} : {};
	const proxyHost = new Proxy(core.typescript.languageServiceHost, {
		get(target, propKey: keyof ts.LanguageServiceHost) {
			if (propKey in proxyApis) {
				return proxyApis[propKey];
			}
			return target[propKey];
		}
	});
	const tsLs = ts.createLanguageService(proxyHost);
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
		return `
			import * as Components from '${fileName.substring(0, fileName.length - '.meta.ts'.length)}';
			export default {} as { [K in keyof typeof Components]: InstanceType<typeof Components[K]>; };
		`;
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

		return {
			props: getProps(),
			events: getEvents(),
			slots: getSlots(),
			exposed: getExposed(),
		};

		function getProps() {

			const $props = symbolProperties.find(prop => prop.escapedName === '$props');
			const propEventRegex = /^(on[A-Z])/;
			let result: PropertyMeta[] = [];

			if ($props) {
				const type = typeChecker.getTypeOfSymbolAtLocation($props, symbolNode!);
				const properties = type.getProperties();

				result = properties
					.map((prop) => {
						const {
							resolveNestedProperties,
						} = createSchemaResolvers(typeChecker, symbolNode!, checkerOptions, ts);

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
			const $emit = symbolProperties.find(prop => prop.escapedName === '$emit');

			if ($emit) {
				const type = typeChecker.getTypeOfSymbolAtLocation($emit, symbolNode!);
				const calls = type.getCallSignatures();

				return calls.map((call) => {

					const {
						resolveEventSignature,
					} = createSchemaResolvers(typeChecker, symbolNode!, checkerOptions, ts);

					return resolveEventSignature(call);
				}).filter(event => event.name);
			}

			return [];
		}

		function getSlots() {

			const propertyName = vueCompilerOptions.target < 3 ? '$scopedSlots' : '$slots';
			const $slots = symbolProperties.find(prop => prop.escapedName === propertyName);

			if ($slots) {
				const type = typeChecker.getTypeOfSymbolAtLocation($slots, symbolNode!);
				const properties = type.getProperties();

				return properties.map((prop) => {
					const {
						resolveSlotProperties,
					} = createSchemaResolvers(typeChecker, symbolNode!, checkerOptions, ts);

					return resolveSlotProperties(prop);
				});
			}

			return [];
		}

		function getExposed() {

			const exposed = symbolProperties.filter(prop =>
				// only exposed props will have a syntheticOrigin
				Boolean((prop as any).syntheticOrigin)
			);

			if (exposed.length) {
				return exposed.map((prop) => {
					const {
						resolveExposedProperties,
					} = createSchemaResolvers(typeChecker, symbolNode!, checkerOptions, ts);

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
	{ rawType, schema: options }: MetaCheckerOptions,
	ts: typeof import('typescript/lib/tsserverlibrary'),
) {
	const visited = new Set<ts.Type>();;

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
			get schema() {
				return schema ??= resolveSchema(subtype);
			},
		};
	}
	function resolveSlotProperties(prop: ts.Symbol): SlotMeta {
		const subtype = typeChecker.getTypeOfSymbolAtLocation(typeChecker.getTypeOfSymbolAtLocation(prop, symbolNode!).getCallSignatures()[0].parameters[0], symbolNode!);
		let schema: PropertyMetaSchema;

		return {
			name: prop.getName(),
			type: typeChecker.typeToString(subtype),
			rawType: rawType ? subtype : undefined,
			description: ts.displayPartsToString(prop.getDocumentationComment(typeChecker)),
			get schema() {
				return schema ??= resolveSchema(subtype);
			},
		};
	}
	function resolveExposedProperties(expose: ts.Symbol): ExposeMeta {
		const subtype = typeChecker.getTypeOfSymbolAtLocation(expose, symbolNode!);
		let schema: PropertyMetaSchema;

		return {
			name: expose.getName(),
			type: typeChecker.typeToString(subtype),
			rawType: rawType ? subtype : undefined,
			description: ts.displayPartsToString(expose.getDocumentationComment(typeChecker)),
			get schema() {
				return schema ??= resolveSchema(subtype);
			},
		};
	}
	function resolveEventSignature(call: ts.Signature): EventMeta {
		const subtype = typeChecker.getTypeOfSymbolAtLocation(call.parameters[1], symbolNode!);
		let schema: PropertyMetaSchema[];

		return {
			name: (typeChecker.getTypeOfSymbolAtLocation(call.parameters[0], symbolNode!) as ts.StringLiteralType).value,
			type: typeChecker.typeToString(subtype),
			rawType: rawType ? subtype : undefined,
			signature: typeChecker.signatureToString(call),
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
		const scriptSetupRanges = descriptor.scriptSetupAst ? vue.parseScriptSetupRanges(ts, descriptor.scriptSetupAst, vueCompilerOptions) : undefined;

		if (descriptor.scriptSetup && scriptSetupRanges?.withDefaultsArg) {

			const defaultsText = descriptor.scriptSetup.content.substring(scriptSetupRanges.withDefaultsArg.start, scriptSetupRanges.withDefaultsArg.end);
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
		} else if (descriptor.scriptSetup && scriptSetupRanges?.propsRuntimeArg) {
			const defaultsText = descriptor.scriptSetup.content.substring(scriptSetupRanges.propsRuntimeArg.start, scriptSetupRanges.propsRuntimeArg.end);
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
