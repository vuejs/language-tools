import type * as ts from 'typescript';

export function getImportPathForFile(
	ts: typeof import('typescript'),
	languageServiceHost: ts.LanguageServiceHost,
	program: ts.Program,
	fileName: string,
	incomingFileName: string,
	preferences: ts.UserPreferences,
): string | undefined {
	const incomingFile = program.getSourceFile(incomingFileName);
	const sourceFile = program.getSourceFile(fileName);
	if (!sourceFile || !incomingFile) {
		return;
	}

	const getModuleSpecifiersWithCacheInfo: (
		moduleSymbol: ts.Symbol,
		checker: ts.TypeChecker,
		compilerOptions: ts.CompilerOptions,
		importingSourceFile: ts.SourceFile,
		host: any,
		userPreferences: ts.UserPreferences,
		options?: {},
	) => {
		moduleSpecifiers: readonly string[];
		computedWithoutCache: boolean;
	} = (ts as any).moduleSpecifiers.getModuleSpecifiersWithCacheInfo;
	const resolutionHost = (ts as any).createModuleSpecifierResolutionHost(program, languageServiceHost);
	const { moduleSpecifiers } = getModuleSpecifiersWithCacheInfo(
		(incomingFile as any).symbol,
		program.getTypeChecker(),
		languageServiceHost.getCompilationSettings(),
		sourceFile,
		resolutionHost,
		preferences,
	);

	return moduleSpecifiers[0];
}
