import * as vue from '@volar/vue-language-core';
import * as ts from 'typescript/lib/tsserverlibrary';

export type PropertyMetaSchema = string | { kind: 'enum', type: string, schema: any[] } | { kind: 'array', type: string, schema: any[] } | { kind: 'object', type: string, schema: Record<string, any> }

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
	const core = vue.createLanguageContext({
		...ts.sys,
		getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options), // should use ts.getDefaultLibFilePath not ts.getDefaultLibFileName
		useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames,
		getCompilationSettings: () => parsedCommandLine.options,
		getScriptFileNames: () => {
			const result = [...parsedCommandLine.fileNames];
			for (const fileName of parsedCommandLine.fileNames) {
				if (fileName.endsWith('.vue')) {
					result.push(fileName + '.meta.ts');
				}
			}
			return result;
		},
		getProjectReferences: () => parsedCommandLine.projectReferences,
		getScriptVersion: (fileName) => '0',
		getScriptSnapshot: (fileName) => {
			if (!scriptSnapshot[fileName]) {
				const fileText = fileName.endsWith('.meta.ts') ? getMetaScriptContent(fileName) : ts.sys.readFile(fileName);
				if (fileText !== undefined) {
					scriptSnapshot[fileName] = ts.ScriptSnapshot.fromString(fileText);
				}
			}
			return scriptSnapshot[fileName];
		},
		getTypeScriptModule: () => ts,
		getVueCompilationSettings: () => parsedCommandLine.vueOptions,
	});
	const tsLs = ts.createLanguageService(core.typescriptLanguageServiceHost);
	const program = tsLs.getProgram()!;
	const typeChecker = program.getTypeChecker();

	return {
		getComponentMeta,
	};

	function getMetaScriptContent(fileName: string) {
		return `
			import Component from '${fileName.substring(0, fileName.length - '.meta.ts'.length)}';
			export default new Component();
		`;
	}

	function getComponentMeta(componentPath: string) {

		const sourceFile = program?.getSourceFile(componentPath + '.meta.ts');
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

		const symbolType = typeChecker.getTypeAtLocation(symbolNode);
		const symbolProperties = symbolType.getProperties();

		return {
			props: getProps(),
			events: getEvents(),
			slots: getSlots(),
		};

		function getProps() {

			const $props = symbolProperties.find(prop => prop.escapedName === '$props');

			if ($props) {
				const type = typeChecker.getTypeOfSymbolAtLocation($props, symbolNode!);
				const properties = type.getApparentProperties();

				function reducer (acc: any, cur: any) {
					acc[cur.name] = cur
					return acc
				}
				function resolveNestedSchema (subtype: ts.Type): PropertyMetaSchema {
					return (subtype.isClassOrInterface() || subtype.isIntersection())
						? {
							kind: 'object',
							type: typeChecker.typeToString(subtype),
							schema: subtype.getApparentProperties().map(resolver).reduce(reducer, {})
						}
					  : typeChecker.typeToString(subtype)
				}
				function resolveArraySchema (subtype: ts.Type): PropertyMetaSchema {
					// @ts-ignore - typescript dts bug, isArrayType exists
					return typeChecker.isArrayType(subtype)
						? {
							kind: 'array',
							type: typeChecker.typeToString(subtype),
							schema: typeChecker.getTypeArguments(subtype as ts.TypeReference).map(resolveSchema)
						}
						: resolveNestedSchema(subtype)
				}
				function resolveSchema (subtype: ts.Type): PropertyMetaSchema {
					return subtype.isUnion()
						? {
							kind: 'enum',
							type: typeChecker.typeToString(subtype),
							schema: subtype.types.map(resolveArraySchema)
						}
						: resolveArraySchema(subtype)
				}

				const resolver = (prop: any): any => {
					const subtype = typeChecker.getTypeOfSymbolAtLocation(prop, symbolNode!)
					typeChecker.getDefaultFromTypeParameter(subtype);

					return {
						name: prop.escapedName,
						documentationComment: ts.displayPartsToString(prop.getDocumentationComment(typeChecker)),
						isOptional: !!prop.declarations?.[0]?.questionToken,
						type: typeChecker.typeToString(subtype),
						schema: resolveSchema(subtype),
					}
				}

				return properties.map(resolver);
			}

			return [];
		}
		function getEvents() {

			const $emit = symbolProperties.find(prop => prop.escapedName === '$emit');

			if ($emit) {
				const type = typeChecker.getTypeOfSymbolAtLocation($emit, symbolNode!);
				const calls = type.getCallSignatures();
				return calls.map(call => ({
					// @ts-ignore
					name: typeChecker.getTypeOfSymbolAtLocation(call.parameters[0], symbolNode!).value,
					parametersType: typeChecker.typeToString(typeChecker.getTypeOfSymbolAtLocation(call.parameters[1], symbolNode!)),
					// @ts-ignore
					parameters: typeChecker.getTypeArguments(typeChecker.getTypeOfSymbolAtLocation(call.parameters[1], symbolNode!)).map(arg => ({
						name: 'TODO',
						type: typeChecker.typeToString(arg),
						isOptional: 'TODO',
					})),
					documentationComment: ts.displayPartsToString(call.getDocumentationComment(typeChecker)),
				}));
			}

			return [];
		}
		function getSlots() {

			const propertyName = (parsedCommandLine.vueOptions.target ?? 3) < 3 ? '$scopedSlots' : '$slots';
			const $slots = symbolProperties.find(prop => prop.escapedName === propertyName);

			if ($slots) {
				const type = typeChecker.getTypeOfSymbolAtLocation($slots, symbolNode!);
				const properties = type.getProperties();
				return properties.map(prop => ({
					name: prop.escapedName as string,
					propsType: typeChecker.typeToString(typeChecker.getTypeOfSymbolAtLocation(typeChecker.getTypeOfSymbolAtLocation(prop, symbolNode!).getCallSignatures()[0].parameters[0], symbolNode!)),
					// props: {}, // TODO
					documentationComment: ts.displayPartsToString(prop.getDocumentationComment(typeChecker)),
				}));
			}

			return [];
		}
	}
}
