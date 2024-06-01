import type * as ts from 'typescript';
import type { RequestContext } from './types';

export function getImportPathForFile(
	this: RequestContext,
	fileName: string,
	incomingFileName: string,
	preferences: ts.UserPreferences
) {
	const { typescript: ts, languageService, languageServiceHost } = this;
	const program = languageService.getProgram();
	const incomingFile = program?.getSourceFile(incomingFileName);
	const sourceFile = program?.getSourceFile(fileName);
	if (!program || !sourceFile || !incomingFile) {
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
	const moduleSpecifiers = getModuleSpecifiersWithCacheInfo(
		(incomingFile as any).symbol,
		program.getTypeChecker(),
		languageServiceHost.getCompilationSettings(),
		sourceFile,
		resolutionHost,
		preferences
	);

	for (const moduleSpecifier of moduleSpecifiers.moduleSpecifiers) {
		return moduleSpecifier;
	}
}
