import * as vue from '@volar/vue-language-core';
import * as ts from 'typescript/lib/tsserverlibrary';

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
		
		const sourceFile = program?.getSourceFile(/.vue$/.test(componentPath) ? componentPath + '.meta.ts' : componentPath);
		if (!sourceFile) {
			throw 'Could not find main source file';
		}

		const moduleSymbol = typeChecker.getSymbolAtLocation(sourceFile);
		if (!moduleSymbol) {
			throw 'Could not find module symbol';
		}

		const exportedSymbols = typeChecker.getExportsOfModule(moduleSymbol);

		const metaList = exportedSymbols.map((symbol) => {
			const [declaration] = symbol.getDeclarations() ?? [];
			const name = symbol.escapedName.toString();
			return { declaration, name };
		}).filter((symbol): symbol is { declaration: ts.ExportAssignment, name: string; } => ts.isExportAssignment(symbol.declaration))
			.map(({ declaration, name }) => {
				const symbolNode = declaration.expression;
				const symbolType = typeChecker.getTypeAtLocation(symbolNode);
				const symbolProperties = symbolType.getProperties();

				return {
					name,
					props: getProps(symbolNode, symbolProperties),
					events: getEvents(symbolNode, symbolProperties),
					slots: getSlots(symbolNode, symbolProperties),
				};
			});

		if (metaList.length === 0) {
			throw 'Could not find a component in this file';
		}


		return metaList;

		function getProps(symbolNode: ts.Expression, symbolProperties: ts.Symbol[]) {
			const $props = symbolProperties.find(prop => prop.escapedName === '$props');

			if ($props) {
				const type = typeChecker.getTypeOfSymbolAtLocation($props, symbolNode!);
				const properties = type.getProperties();
				return properties.map(prop => ({
					name: prop.escapedName as string,
					// @ts-ignore
					isOptional: !!prop.declarations?.[0]?.questionToken,
					type: typeChecker.typeToString(typeChecker.getTypeOfSymbolAtLocation(prop, symbolNode!)),
					documentationComment: ts.displayPartsToString(prop.getDocumentationComment(typeChecker)),
				}));
			}

			return [];
		}

		function getEvents(symbolNode: ts.Expression, symbolProperties: ts.Symbol[]) {

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
		function getSlots(symbolNode: ts.Expression, symbolProperties: ts.Symbol[]) {

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
