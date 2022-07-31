import * as vue from '@volar/vue-language-core';
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
	const parsedCommandLine = vue.tsShared.createParsedCommandLine(ts, {
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

	return {
		getGlobalPropNames,
		getExportNames,
		getComponentMeta,
	};

	/**
	 * Get helper array to map internal properties added by vue to any components
	 * 
	 * @example
	 * ```ts
	 * import { createComponentMetaChecker } from 'vue-component-meta'
	 * 
	 * const checker = createComponentMetaChecker('path/to/tsconfig.json')
	 * const meta = checker.getComponentMeta('path/to/component.vue')
	 * const globalPropNames = checker.getGlobalPropNames();
	 * const props = meta.props.filter(prop => !globalPropNames.includes(prop.name))
	 * ```
	 */
	function getGlobalPropNames() {
		const meta = getComponentMeta(globalComponentName);
		return meta.props.map(prop => prop.name);
	}

	function getMetaFileName(fileName: string) {
		return (fileName.endsWith('.vue') ? fileName : fileName.substring(0, fileName.lastIndexOf('.'))) + '.meta.ts';
	}

	function getMetaScriptContent(fileName: string) {
		return `
			import * as Components from '${fileName.substring(0, fileName.length - '.meta.ts'.length)}';
			export default {} as { [K in keyof typeof Components]: InstanceType<typeof Components[K]>; };;
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
		const {
			resolveNestedProperties,
			resolveEventSignature,
			resolveExposedProperties,
			resolveSlotProperties,
		} = createSchemaResolvers(typeChecker, symbolNode!, checkerOptions.schema);

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
				const properties = type.getApparentProperties();

				result = properties
					.map(resolveNestedProperties)
					.filter((prop) => !prop.name.match(propEventRegex));
			}

			// fill defaults
			const printer = ts.createPrinter(checkerOptions.printerOptions);
			const snapshot = host.getScriptSnapshot(componentPath)!;
			const vueDefaults = componentPath.endsWith('.vue') && exportName === 'default' ? readVueComponentDefaultProps(snapshot.getText(0, snapshot.getLength()), printer) : {};
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
					prop.default = defaultExp;
				}
			}

			return result;
		}

		function getEvents() {

			const $emit = symbolProperties.find(prop => prop.escapedName === '$emit');

			if ($emit) {
				const type = typeChecker.getTypeOfSymbolAtLocation($emit, symbolNode!);
				const calls = type.getCallSignatures();

				return calls.map(resolveEventSignature).filter(event => event.name);
			}

			return [];
		}

		function getSlots() {

			const propertyName = (parsedCommandLine.vueOptions.target ?? 3) < 3 ? '$scopedSlots' : '$slots';
			const $slots = symbolProperties.find(prop => prop.escapedName === propertyName);

			if ($slots) {
				const type = typeChecker.getTypeOfSymbolAtLocation($slots, symbolNode!);
				const properties = type.getProperties();

				return properties.map(resolveSlotProperties);
			}

			return [];
		}

		function getExposed() {
			const exposed = symbolProperties.filter(prop =>
				// only exposed props will have a syntheticOrigin
				Boolean((prop as any).syntheticOrigin)
			);

			if (exposed.length) {
				return exposed.map(resolveExposedProperties);
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

function createSchemaResolvers(typeChecker: ts.TypeChecker, symbolNode: ts.Expression, options: MetaCheckerSchemaOptions = {}) {
	const ignore = options.ignore ?? [];
	const enabled = options.enabled ?? false;

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

	function reducer(acc: any, cur: any) {
		acc[cur.name] = cur;
		return acc;
	}

	function resolveNestedProperties(prop: ts.Symbol): PropertyMeta {
		const subtype = typeChecker.getTypeOfSymbolAtLocation(prop, symbolNode!);
		const schema = enabled ? resolveSchema(subtype) : undefined;

		return {
			name: prop.getEscapedName().toString(),
			description: ts.displayPartsToString(prop.getDocumentationComment(typeChecker)),
			tags: prop.getJsDocTags(typeChecker).map(tag => ({
				name: tag.name,
				text: tag.text?.map(part => part.text).join(''),
			})),
			required: !Boolean((prop.declarations?.[0] as ts.ParameterDeclaration)?.questionToken ?? false),
			type: typeChecker.typeToString(subtype),
			schema,
		};
	}
	function resolveSlotProperties(prop: ts.Symbol): SlotMeta {
		const subtype = typeChecker.getTypeOfSymbolAtLocation(typeChecker.getTypeOfSymbolAtLocation(prop, symbolNode!).getCallSignatures()[0].parameters[0], symbolNode!);
		const schema = enabled ? resolveSchema(subtype) : undefined;

		return {
			name: prop.getName(),
			type: typeChecker.typeToString(subtype),
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
	function resolveEventSchema(subtype: ts.Type): PropertyMetaSchema {
		return (subtype.getCallSignatures().length === 1)
			? resolveCallbackSchema(subtype.getCallSignatures()[0])
			: typeChecker.typeToString(subtype);
	}
	function resolveNestedSchema(subtype: ts.Type): PropertyMetaSchema {
		if (
			subtype.getCallSignatures().length === 0 &&
			(subtype.isClassOrInterface() || subtype.isIntersection() || (subtype as ts.ObjectType).objectFlags & ts.ObjectFlags.Anonymous)
		) {
			if (shouldIgnore(subtype)) {
				return typeChecker.typeToString(subtype);
			}

			return {
				kind: 'object',
				type: typeChecker.typeToString(subtype),
				schema: subtype.getProperties().map(resolveNestedProperties).reduce(reducer, {})
			};
		}
		return resolveEventSchema(subtype);
	}
	function resolveArraySchema(subtype: ts.Type): PropertyMetaSchema {
		// @ts-ignore - typescript internal, isArrayLikeType exists
		if (typeChecker.isArrayLikeType(subtype)) {
			if (shouldIgnore(subtype)) {
				return typeChecker.typeToString(subtype);
			}

			return {
				kind: 'array',
				type: typeChecker.typeToString(subtype),
				schema: typeChecker.getTypeArguments(subtype as ts.TypeReference).map(resolveSchema)
			};
		}

		return resolveNestedSchema(subtype);
	}
	function resolveSchema(subtype: ts.Type): PropertyMetaSchema {
		return subtype.isUnion()
			? {
				kind: 'enum',
				type: typeChecker.typeToString(subtype),
				schema: subtype.types.map(resolveArraySchema)
			}
			: resolveArraySchema(subtype);
	}

	return {
		resolveNestedProperties,
		resolveSlotProperties,
		resolveEventSignature,
		resolveExposedProperties,
		resolveCallbackSchema,
		resolveEventSchema,
		resolveNestedSchema,
		resolveArraySchema,
		resolveSchema,
	};
}

function readVueComponentDefaultProps(vueFileText: string, printer: ts.Printer) {

	const result: Record<string, string> = {};

	scriptSetupWorker();
	sciptWorker();

	return result;

	function scriptSetupWorker() {

		const vueSourceFile = vue.createSourceFile('/tmp.vue', vueFileText, {}, {}, ts);
		const descriptor = vueSourceFile.getDescriptor();
		const scriptSetupRanges = vueSourceFile.getScriptSetupRanges();

		if (descriptor.scriptSetup && scriptSetupRanges?.withDefaultsArg) {

			const defaultsText = descriptor.scriptSetup.content.substring(scriptSetupRanges.withDefaultsArg.start, scriptSetupRanges.withDefaultsArg.end);
			const ast = ts.createSourceFile('/tmp.' + descriptor.scriptSetup.lang, '(' + defaultsText + ')', ts.ScriptTarget.Latest);
			const obj = findObjectLiteralExpression(ast);

			if (obj) {
				for (const prop of obj.properties) {
					if (ts.isPropertyAssignment(prop)) {
						const name = prop.name.getText(ast);
						const exp = printer.printNode(ts.EmitHint.Expression, resolveDefaultOptionExpression(prop.initializer), ast);;
						result[name] = exp;
					}
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
	}

	function sciptWorker() {

		const vueSourceFile = vue.createSourceFile('/tmp.vue', vueFileText, {}, {}, ts);
		const descriptor = vueSourceFile.getDescriptor();

		if (descriptor.script) {
			const scriptResult = readTsComponentDefaultProps(descriptor.script.lang, descriptor.script.content, 'default', printer);
			for (const [key, value] of Object.entries(scriptResult)) {
				result[key] = value;
			}
		}
	}
}

function readTsComponentDefaultProps(lang: string, tsFileText: string, exportName: string, printer: ts.Printer) {

	const result: Record<string, string> = {};
	const ast = ts.createSourceFile('/tmp.' + lang, tsFileText, ts.ScriptTarget.Latest);
	const props = getPropsNode();

	if (props) {
		for (const prop of props.properties) {
			if (ts.isPropertyAssignment(prop)) {
				const name = prop.name?.getText(ast);
				if (ts.isObjectLiteralExpression(prop.initializer)) {
					for (const propOption of prop.initializer.properties) {
						if (ts.isPropertyAssignment(propOption)) {
							if (propOption.name?.getText(ast) === 'default') {
								const _default = propOption.initializer;
								result[name] = printer.printNode(ts.EmitHint.Expression, resolveDefaultOptionExpression(_default), ast);
							}
						}
					}
				}
			}
		}
	}

	return result;

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
