import * as vue from '@volar/vue-language-core';
import * as ts from 'typescript/lib/tsserverlibrary';

export interface ComponentMeta {
	props: PropertyMeta[]
	events: EventMeta[]
	slots: SlotMeta[]
	exposed: ExposeMeta[]
}
export interface PropertyMeta {
	name: string;
	default?: string;
	description: string;
	required: boolean;
	type: string;
	tags: { name: string, text?: string; }[];
	schema: PropertyMetaSchema;
};
export interface EventMeta {
	name: string;
	type: string;
	signature: string;
	schema: PropertyMetaSchema[];
}
export interface SlotMeta {
	name: string;
	type: string;
	description: string;
}
export interface ExposeMeta {
	name: string;
	type: string;
	description: string;
}

export type PropertyMetaSchema = string
	| { kind: 'enum', type: string, schema: PropertyMetaSchema[]; }
	| { kind: 'array', type: string, schema: PropertyMetaSchema[]; }
	| { kind: 'event', type: string, schema: PropertyMetaSchema[]; }
	| { kind: 'object', type: string, schema: Record<string, PropertyMeta>; };

function createSchemaResolvers(typeChecker: ts.TypeChecker, symbolNode: ts.Expression) {
	function reducer(acc: any, cur: any) {
		acc[cur.name] = cur;
		return acc;
	}
	function resolveSymbolSchema(prop: ts.Symbol): PropertyMeta {
		const subtype = typeChecker.getTypeOfSymbolAtLocation(prop, symbolNode!);
		typeChecker.getDefaultFromTypeParameter(subtype);

		return {
			name: prop.getEscapedName().toString(),
			description: ts.displayPartsToString(prop.getDocumentationComment(typeChecker)),
			tags: prop.getJsDocTags(typeChecker).map(tag => ({
				name: tag.name,
				text: tag.text?.map(part => part.text).join(''),
			})),
			required: !Boolean((prop.declarations?.[0] as ts.ParameterDeclaration)?.questionToken ?? false),
			type: typeChecker.typeToString(subtype),
			schema: resolveSchema(subtype),
		};
	}
	function resolveCallbackSchema(signature: ts.Signature): PropertyMetaSchema {
		return {
			kind: 'event',
			type: typeChecker.signatureToString(signature),
			schema: typeChecker.getTypeArguments(typeChecker.getTypeOfSymbolAtLocation(signature.parameters[0], symbolNode) as ts.TypeReference).map(resolveSchema)
		};
	}
	function resolveEventSchema(subtype: ts.Type): PropertyMetaSchema {
		return (subtype.getCallSignatures().length === 1)
			? resolveCallbackSchema(subtype.getCallSignatures()[0])
			: typeChecker.typeToString(subtype);
	}
	function resolveNestedSchema(subtype: ts.Type): PropertyMetaSchema {
		// !!(subtype.flags & ts.TypeFlags.Object)
		return (subtype.isClassOrInterface() || subtype.isIntersection())
			? {
				kind: 'object',
				type: typeChecker.typeToString(subtype),
				schema: subtype.getProperties().map(resolveSymbolSchema).reduce(reducer, {})
			}
			: resolveEventSchema(subtype);
	}
	function resolveArraySchema(subtype: ts.Type): PropertyMetaSchema {
		// @ts-ignore - typescript internal, isArrayLikeType exists
		return typeChecker.isArrayLikeType(subtype)
			? {
				kind: 'array',
				type: typeChecker.typeToString(subtype),
				schema: typeChecker.getTypeArguments(subtype as ts.TypeReference).map(resolveSchema)
			}
			: resolveNestedSchema(subtype);
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
		resolveSymbolSchema,
		resolveCallbackSchema,
		resolveEventSchema,
		resolveNestedSchema,
		resolveArraySchema,
		resolveSchema,
	};
}

export function createComponentMetaChecker(tsconfigPath: string) {

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
	const tsLs = ts.createLanguageService(core.typescriptLanguageServiceHost);
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

		return {
			props: getProps(),
			events: getEvents(),
			slots: getSlots(),
			exposed: getExposed(),
		};

		function getProps(): PropertyMeta[] {

			const $props = symbolProperties.find(prop => prop.escapedName === '$props');
			let result: PropertyMeta[] = [];

			if ($props) {
				const type = typeChecker.getTypeOfSymbolAtLocation($props, symbolNode!);
				const properties = type.getApparentProperties();
				const { resolveSymbolSchema } = createSchemaResolvers(typeChecker, symbolNode!);

				result = properties.map(resolveSymbolSchema);
			}

			// fill defaults
			if (componentPath.endsWith('.vue') && exportName === 'default') {
				const snapshot = host.getScriptSnapshot(componentPath)!;
				const defaults = readCmponentDefaultProps(snapshot.getText(0, snapshot.getLength()));
				for (const propName in defaults) {
					const prop = result.find(p => p.name === propName);
					if (prop) {
						prop.default = defaults[propName];
					}
				}
			}

			return result;
		}

		function getEvents(): EventMeta[] {

			const $emit = symbolProperties.find(prop => prop.escapedName === '$emit');

			if ($emit) {
				const type = typeChecker.getTypeOfSymbolAtLocation($emit, symbolNode!);
				const calls = type.getCallSignatures();
				const { resolveSchema } = createSchemaResolvers(typeChecker, symbolNode!);

				return calls.map(call => ({
					name: (typeChecker.getTypeOfSymbolAtLocation(call.parameters[0], symbolNode!) as ts.StringLiteralType).value,
					type: typeChecker.typeToString(typeChecker.getTypeOfSymbolAtLocation(call.parameters[1], symbolNode!)),
					signature: typeChecker.signatureToString(call),
					schema: typeChecker.getTypeArguments(typeChecker.getTypeOfSymbolAtLocation(call.parameters[1], symbolNode!) as ts.TypeReference).map(resolveSchema),
				}));
			}

			return [];
		}

		function getSlots(): SlotMeta[] {

			const propertyName = (parsedCommandLine.vueOptions.target ?? 3) < 3 ? '$scopedSlots' : '$slots';
			const $slots = symbolProperties.find(prop => prop.escapedName === propertyName);

			if ($slots) {
				const type = typeChecker.getTypeOfSymbolAtLocation($slots, symbolNode!);
				const properties = type.getProperties();
				return properties.map(prop => ({
					name: prop.getName(),
					type: typeChecker.typeToString(typeChecker.getTypeOfSymbolAtLocation(typeChecker.getTypeOfSymbolAtLocation(prop, symbolNode!).getCallSignatures()[0].parameters[0], symbolNode!)),
					description: ts.displayPartsToString(prop.getDocumentationComment(typeChecker)),
				}));
			}

			return [];
		}

		function getExposed(): ExposeMeta[] {

			const exposed = symbolProperties.filter(prop =>
				// only exposed props will have a syntheticOrigin
				Boolean((prop as any).syntheticOrigin)
			);

			if (exposed.length) {
				return exposed.map(expose => ({
					name: expose.getName(),
					type: typeChecker.typeToString(typeChecker.getTypeOfSymbolAtLocation(expose, symbolNode!)),
					description: ts.displayPartsToString(expose.getDocumentationComment(typeChecker)),
				}));
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

function readCmponentDefaultProps(fileText: string) {

	const vueSourceFile = vue.createSourceFile('/tmp.vue', fileText, {}, {}, ts);
	const descriptor = vueSourceFile.getDescriptor();
	const scriptSetupRanges = vueSourceFile.getScriptSetupRanges();
	const result: Record<string, string> = {};

	if (descriptor.scriptSetup && scriptSetupRanges?.withDefaultsArg) {

		const defaultsText = descriptor.scriptSetup.content.substring(scriptSetupRanges.withDefaultsArg.start, scriptSetupRanges.withDefaultsArg.end);
		const ast = ts.createSourceFile('/tmp.' + descriptor.scriptSetup.lang, '(' + defaultsText + ')', ts.ScriptTarget.Latest);
		const obj = findObjectLiteralExpression(ast);

		if (obj) {
			for (const prop of obj.properties) {
				if (ts.isPropertyAssignment(prop)) {
					const name = prop.name.getText(ast);
					const exp = prop.initializer.getText(ast);
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

	return result;
}
