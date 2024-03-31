import type * as ts from 'typescript';

const enum ExportKind {
	Named,
	Default,
	ExportEquals,
	UMD,
}

interface SymbolExportInfo {
	readonly symbol: Symbol;
	readonly moduleSymbol: Symbol;
	/** Set if `moduleSymbol` is an external module, not an ambient module */
	moduleFileName: string | undefined;
	exportKind: ExportKind;
	targetFlags: ts.SymbolFlags;
	/** True if export was only found via the package.json AutoImportProvider (for telemetry). */
	isFromPackageJson: boolean;
}

export function getImportPathForFile(
	this: {
		typescript: typeof import('typescript');
		languageService: ts.LanguageService;
		languageServiceHost: ts.LanguageServiceHost;
	},
	fileName: string,
	incomingFileName: string,
	preferences: ts.UserPreferences,
) {
	const { typescript: ts, languageService, languageServiceHost } = this;
	const { createImportSpecifierResolver }: {
		createImportSpecifierResolver(
			importingFile: ts.SourceFile,
			program: ts.Program,
			host: ts.LanguageServiceHost,
			preferences: ts.UserPreferences
		): {
			getModuleSpecifierForBestExportInfo(
				exportInfo: readonly SymbolExportInfo[],
				symbolName: string,
				position: number,
				isValidTypeOnlyUseSite: boolean,
				fromCacheOnly?: boolean
			): { exportInfo?: SymbolExportInfo, moduleSpecifier: string, computedWithoutCacheCount: number; } | undefined;
		};
	} = (ts as any).codefix;
	const program = languageService.getProgram();
	const sourceFile = program?.getSourceFile(fileName);
	const incomingFile = program?.getSourceFile(incomingFileName);
	if (!program || !sourceFile || !incomingFile) {
		return;
	}
	const importSpecifierResolver = createImportSpecifierResolver(sourceFile, program, languageServiceHost, preferences);
	const info = importSpecifierResolver.getModuleSpecifierForBestExportInfo([{
		// @ts-expect-error
		symbol: incomingFile.symbol,
		// @ts-expect-error
		moduleSymbol: incomingFile.symbol,
		moduleFileName: incomingFileName,
		exportKind: ExportKind.Default,
		isFromPackageJson: false,
		targetFlags: 0,
	}], 'default', 0, false);
	return info?.moduleSpecifier;
}
