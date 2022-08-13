import * as vue from '@volar/vue-language-core';
import { parseScriptSetupRanges } from '@volar/vue-language-core';
import * as ts from 'typescript/lib/tsserverlibrary';

import type {
	MetaCheckerOptions,
	ComponentMeta,
	EventMeta,
	ExposeMeta,
	MetaCheckerSchemaOptions,
	PropertyMeta,
	PropertyMetaSchema,
	SlotMeta
} from './types';

export type {
	MetaCheckerOptions,
	ComponentMeta,
	EventMeta,
	ExposeMeta,
	MetaCheckerSchemaOptions,
	PropertyMeta,
	PropertyMetaSchema,
	SlotMeta
};

export function createComponentMetaChecker(tsconfigPath: string, checkerOptions: MetaCheckerOptions = {}) {
	const parsedCommandLine = vue.createParsedCommandLine(ts, {
		useCaseSensitiveFileNames: ts.sys.useCaseSensitiveFileNames,
		readDirectory: (path, extensions, exclude, include, depth) => {
			return ts.sys.readDirectory(path, [...extensions, '.vue'], exclude, include, depth);
		},
		fileExists: ts.sys.fileExists,
		readFile: ts.sys.readFile,
	}, tsconfigPath);
	const scriptSnapshot: Record<string, ts.IScriptSnapshot> = {};
	const globalComponentName = tsconfigPath.replace(/\\/g, '/') + '.global.ts';
	const host: vue.LanguageServiceHost = {
		...ts.sys,
		getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options), // should use ts.getDefaultLibFilePath not ts.getDefaultLibFileName
		useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames,
		getCompilationSettings: () => parsedCommandLine.options,
		getScriptFileNames: () => {
			return [
				...parsedCommandLine.fileNames,
				...parsedCommandLine.fileNames.map(getMetaFileName),
				globalComponentName,
				getMetaFileName(globalComponentName),
			];
		},
		getProjectReferences: () => parsedCommandLine.projectReferences,
		getScriptVersion: (fileName) => '0',
		getScriptSnapshot: (fileName) => {
			if (!scriptSnapshot[fileName]) {
				let fileText: string | undefined;
				if (fileName.endsWith('.meta.ts')) {
					fileText = getMetaScriptContent(fileName);
				}
				else if (fileName === globalComponentName) {
					fileText = `
						import { defineComponent } from 'vue';
						export default defineComponent({});
					`;
				}
				else {
					fileText = ts.sys.readFile(fileName);
				}
				if (fileText !== undefined) {
					scriptSnapshot[fileName] = ts.ScriptSnapshot.fromString(fileText);
				}
			}
			return scriptSnapshot[fileName];
		},
		getTypeScriptModule: () => ts,
		getVueCompilationSettings: () => parsedCommandLine.vueOptions,
	};
	const core = vue.createLanguageContext(host);
	const proxyApis: Partial<ts.LanguageServiceHost> = checkerOptions.forceUseTs ? {
		getScriptKind: (fileName) => {
			if (fileName.endsWith('.vue.js')) {
				return ts.ScriptKind.TS;
			}
			if (fileName.endsWith('.vue.jsx')) {
				return ts.ScriptKind.TSX;
			}
			return core.typescriptLanguageServiceHost.getScriptKind!(fileName);
		},
	} : {};
	const proxyHost = new Proxy(core.typescriptLanguageServiceHost, {
		get(target, propKey: keyof ts.LanguageServiceHost) {
			if (propKey in proxyApis) {
				return proxyApis[propKey];
			}
			return target[propKey];
		}
	});
	const tsLs = ts.createLanguageService(proxyHost);
	const program = tsLs.getProgram()!;
	const typeChecker = program.getTypeChecker();
	let globalPropNames: string[] = [];
	globalPropNames = getComponentMeta(globalComponentName).props.map(prop => prop.name);

	return {
		getExportNames,
		getComponentMeta,
		__internal__: {
			program,
			tsLs,
			typeChecker,
		},
	};

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
		return _getExports(componentPath).exports.map(e => e.getName());
	}

	function getComponentMeta(componentPath: string, exportName = 'default'): ComponentMeta {

		const { symbolNode, exports } = _getExports(componentPath);
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
						} = createSchemaResolvers(typeChecker, symbolNode!, checkerOptions);

						return resolveNestedProperties(prop);
					})
					.filter((prop) => !prop.name.match(propEventRegex));
			}

			// fill global
			for (const prop of result) {
				prop.global = globalPropNames.includes(prop.name);
			}

			// fill defaults
			const printer = checkerOptions.printer ? ts.createPrinter(checkerOptions.printer) : undefined;
			const snapshot = host.getScriptSnapshot(componentPath)!;

			const vueDefaults = componentPath.endsWith('.vue') && exportName === 'default'
				? readVueComponentDefaultProps(core, snapshot, printer)
				: {};
			const tsDefaults = !componentPath.endsWith('.vue') ? readTsComponentDefaultProps(
				componentPath.substring(componentPath.lastIndexOf('.') + 1), // ts | js | tsx | jsx
				snapshot.getText(0, snapshot.getLength()),
				exportName,
				printer,
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
					} = createSchemaResolvers(typeChecker, symbolNode!, checkerOptions);

					return resolveEventSignature(call);
				}).filter(event => event.name);
			}

			return [];
		}

		function getSlots() {

			const propertyName = (parsedCommandLine.vueOptions.target ?? 3) < 3 ? '$scopedSlots' : '$slots';
			const $slots = symbolProperties.find(prop => prop.escapedName === propertyName);

			if ($slots) {
				const type = typeChecker.getTypeOfSymbolAtLocation($slots, symbolNode!);
				const properties = type.getProperties();

				return properties.map((prop) => {
					const {
						resolveSlotProperties,
					} = createSchemaResolvers(typeChecker, symbolNode!, checkerOptions);

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
					} = createSchemaResolvers(typeChecker, symbolNode!, checkerOptions);

					return resolveExposedProperties(prop);
				});
			}

			return [];
		}
	}

	function _getExports(componentPath: string) {

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

function createSchemaResolvers(typeChecker: ts.TypeChecker, symbolNode: ts.Expression, { rawType, schema: options }: MetaCheckerOptions) {
	const enabled = !!options;
	const ignore = typeof options === 'object' ? [...options?.ignore ?? []] : [];

	function shouldIgnore(subtype: ts.Type) {
		const type = typeChecker.typeToString(subtype);
		if (type === 'any') {
			return true;
		}

		if (ignore.length === 0) {
			return false;
		}

		return ignore.includes(type);
	}

	function setVisited(subtype: ts.Type) {
		const type = typeChecker.typeToString(subtype);
		ignore.push(type);
	}

	function reducer(acc: any, cur: any) {
		acc[cur.name] = cur;
		return acc;
	}

	function resolveNestedProperties(prop: ts.Symbol): PropertyMeta {
		const subtype = typeChecker.getTypeOfSymbolAtLocation(prop, symbolNode!);
		const schema = enabled ? resolveSchema(subtype) : undefined;

		return {
			name: prop.getEscapedName().toString(),
			global: false,
			description: ts.displayPartsToString(prop.getDocumentationComment(typeChecker)),
			tags: prop.getJsDocTags(typeChecker).map(tag => ({
				name: tag.name,
				text: tag.text?.map(part => part.text).join(''),
			})),
			required: !Boolean((prop.declarations?.[0] as ts.ParameterDeclaration)?.questionToken ?? false),
			type: typeChecker.typeToString(subtype),
			rawType: rawType ? subtype : undefined,
			schema,
		};
	}
	function resolveSlotProperties(prop: ts.Symbol): SlotMeta {
		const subtype = typeChecker.getTypeOfSymbolAtLocation(typeChecker.getTypeOfSymbolAtLocation(prop, symbolNode!).getCallSignatures()[0].parameters[0], symbolNode!);
		const schema = enabled ? resolveSchema(subtype) : undefined;

		return {
			name: prop.getName(),
			type: typeChecker.typeToString(subtype),
			rawType: rawType ? subtype : undefined,
			description: ts.displayPartsToString(prop.getDocumentationComment(typeChecker)),
			schema,
		};
	}
	function resolveExposedProperties(expose: ts.Symbol): ExposeMeta {
		const subtype = typeChecker.getTypeOfSymbolAtLocation(expose, symbolNode!);
		const schema = enabled ? resolveSchema(subtype) : undefined;

		return {
			name: expose.getName(),
			type: typeChecker.typeToString(subtype),
			rawType: rawType ? subtype : undefined,
			description: ts.displayPartsToString(expose.getDocumentationComment(typeChecker)),
			schema,
		};
	}
	function resolveEventSignature(call: ts.Signature): EventMeta {
		const subtype = typeChecker.getTypeOfSymbolAtLocation(call.parameters[1], symbolNode!);
		const schema = enabled
			? typeChecker.getTypeArguments(subtype as ts.TypeReference).map(resolveSchema)
			: undefined;

		return {
			name: (typeChecker.getTypeOfSymbolAtLocation(call.parameters[0], symbolNode!) as ts.StringLiteralType).value,
			type: typeChecker.typeToString(subtype),
			rawType: rawType ? subtype : undefined,
			signature: typeChecker.signatureToString(call),
			schema,
		};
	}

	function resolveCallbackSchema(signature: ts.Signature): PropertyMetaSchema {
		const schema = enabled && signature.parameters.length > 0
			? typeChecker
				.getTypeArguments(typeChecker.getTypeOfSymbolAtLocation(signature.parameters[0], symbolNode) as ts.TypeReference)
				.map(resolveSchema)
			: undefined;

		return {
			kind: 'event',
			type: typeChecker.signatureToString(signature),
			schema,
		};
	}
	function resolveSchema(subtype: ts.Type): PropertyMetaSchema {
		const type = typeChecker.typeToString(subtype);
		let schema: PropertyMetaSchema = type;

		if (shouldIgnore(subtype)) {
			return type;
		}

		setVisited(subtype);

		if (subtype.isUnion()) {
			schema = {
				kind: 'enum',
				type,
				schema: subtype.types.map(resolveSchema)
			};
		}

		// @ts-ignore - typescript internal, isArrayLikeType exists
		else if (typeChecker.isArrayLikeType(subtype)) {
			schema = {
				kind: 'array',
				type,
				schema: typeChecker.getTypeArguments(subtype as ts.TypeReference).map(resolveSchema)
			};
		}

		else if (
			subtype.getCallSignatures().length === 0 &&
			(subtype.isClassOrInterface() || subtype.isIntersection() || (subtype as ts.ObjectType).objectFlags & ts.ObjectFlags.Anonymous)
		) {
			// setVisited(subtype);
			schema = {
				kind: 'object',
				type,
				schema: subtype.getProperties().map(resolveNestedProperties).reduce(reducer, {})
			};
		}

		else if (subtype.getCallSignatures().length === 1) {
			schema = resolveCallbackSchema(subtype.getCallSignatures()[0]);
		}

		return schema;
	}

	return {
		resolveNestedProperties,
		resolveSlotProperties,
		resolveEventSignature,
		resolveExposedProperties,
		resolveSchema,
	};
}

function readVueComponentDefaultProps(core: vue.LanguageContext, vueFileScript: ts.IScriptSnapshot, printer: ts.Printer | undefined) {
	let result: Record<string, { default?: string, required?: boolean; }> = {};

	scriptSetupWorker();
	scriptWorker();

	return result;

	function scriptSetupWorker() {

		const vueSourceFile = vue.createSourceFile('/tmp.vue', vueFileScript, {}, ts, core.plugins);
		const descriptor = vueSourceFile.sfc;
		const scriptSetupRanges = descriptor.scriptSetupAst ? parseScriptSetupRanges(ts, descriptor.scriptSetupAst) : undefined;

		if (descriptor.scriptSetup && scriptSetupRanges?.withDefaultsArg) {

			const defaultsText = descriptor.scriptSetup.content.substring(scriptSetupRanges.withDefaultsArg.start, scriptSetupRanges.withDefaultsArg.end);
			const ast = ts.createSourceFile('/tmp.' + descriptor.scriptSetup.lang, '(' + defaultsText + ')', ts.ScriptTarget.Latest);
			const obj = findObjectLiteralExpression(ast);

			if (obj) {
				for (const prop of obj.properties) {
					if (ts.isPropertyAssignment(prop)) {
						const name = prop.name.getText(ast);
						const expNode = resolveDefaultOptionExpression(prop.initializer);
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
					...resolvePropsOption(ast, obj, printer),
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

		const vueSourceFile = vue.createSourceFile('/tmp.vue', vueFileScript, {}, ts, core.plugins);
		const descriptor = vueSourceFile.sfc;

		if (descriptor.script) {
			const scriptResult = readTsComponentDefaultProps(descriptor.script.lang, descriptor.script.content, 'default', printer);
			for (const [key, value] of Object.entries(scriptResult)) {
				result[key] = value;
			}
		}
	}
}

function readTsComponentDefaultProps(lang: string, tsFileText: string, exportName: string, printer: ts.Printer | undefined) {

	const ast = ts.createSourceFile('/tmp.' + lang, tsFileText, ts.ScriptTarget.Latest);
	const props = getPropsNode();

	if (props) {
		return resolvePropsOption(ast, props, printer);
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

function resolvePropsOption(ast: ts.SourceFile, props: ts.ObjectLiteralExpression, printer: ts.Printer | undefined) {

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
					const expNode = resolveDefaultOptionExpression((defaultProp as any).initializer);
					const expText = printer?.printNode(ts.EmitHint.Expression, expNode, ast) ?? expNode.getText(ast);
					result[name].default = expText;
				}
			}
		}
	}

	return result;
}

function resolveDefaultOptionExpression(_default: ts.Expression) {
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
