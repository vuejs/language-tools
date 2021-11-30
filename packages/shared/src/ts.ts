import * as fs from 'fs';
import type * as ts from 'typescript/lib/tsserverlibrary';
import * as path from 'upath';
import { normalizeFileName } from './path';

export function getTsCompletions(ts: typeof import('typescript/lib/tsserverlibrary')): {
	StringCompletions: {
		getStringLiteralCompletions: Function,
		getStringLiteralCompletionDetails: Function,
	},
	moduleSpecifierResolutionLimit: 100,
	moduleSpecifierResolutionCacheAttemptLimit: 1000,
	SortText: {
		LocalDeclarationPriority: '10',
		LocationPriority: '11',
		OptionalMember: '12',
		MemberDeclaredBySpreadAssignment: '13',
		SuggestedClassMembers: '14',
		GlobalsOrKeywords: '15',
		AutoImportSuggestions: '16',
		JavascriptIdentifiers: '17',
		DeprecatedLocalDeclarationPriority: '18',
		DeprecatedLocationPriority: '19',
		DeprecatedOptionalMember: '20',
		DeprecatedMemberDeclaredBySpreadAssignment: '21',
		DeprecatedSuggestedClassMembers: '22',
		DeprecatedGlobalsOrKeywords: '23',
		DeprecatedAutoImportSuggestions: '24'
	},
	CompletionSource: { ThisProperty: 'ThisProperty/' },
	getCompletionsAtPosition: Function,
	getCompletionEntriesFromSymbols: Function,
	getCompletionEntryDetails: Function,
	createCompletionDetailsForSymbol: Function,
	createCompletionDetails: Function,
	getCompletionEntrySymbol: Function,
	CompletionKind: {
		'0': 'ObjectPropertyDeclaration',
		'1': 'Global',
		'2': 'PropertyAccess',
		'3': 'MemberLike',
		'4': 'String',
		'5': 'None',
		ObjectPropertyDeclaration: 0,
		Global: 1,
		PropertyAccess: 2,
		MemberLike: 3,
		String: 4,
		None: 5
	},
	getPropertiesForObjectExpression: Function,
} | undefined {
	return (ts as any).Completions;
}

export function createTsLanguageService(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	host: ts.LanguageServiceHost,
) {
	// TODO: new cache logic https://github.com/microsoft/TypeScript/blob/4c0a51e14b67460b47bdcebea6b70270a83a243e/src/server/project.ts#L258
	return ts.createLanguageService(host);
}

export function getWorkspaceTypescriptPath(tsdk: string, workspaceFolderFsPaths: string[]) {
	if (path.isAbsolute(tsdk)) {
		const tsPath = findTypescriptModulePathInLib(tsdk);
		if (tsPath) {
			return tsPath;
		}
	}
	else {
		for (const folder of workspaceFolderFsPaths) {
			const tsPath = findTypescriptModulePathInLib(path.join(folder, tsdk));
			if (tsPath) {
				return tsPath;
			}
		}
	}
}

export function getWorkspaceTypescriptLocalizedPath(tsdk: string, lang: string, workspaceFolderFsPaths: string[]) {
	if (path.isAbsolute(tsdk)) {
		const tsPath = findTypescriptLocalizedPathInLib(tsdk, lang);
		if (tsPath) {
			return tsPath;
		}
	}
	else {
		for (const folder of workspaceFolderFsPaths) {
			const tsPath = findTypescriptLocalizedPathInLib(path.join(folder, tsdk), lang);
			if (tsPath) {
				return tsPath;
			}
		}
	}
}

export function findTypescriptModulePathInLib(lib: string) {

	const tsserverlibrary = path.join(lib, 'tsserverlibrary.js');
	const typescript = path.join(lib, 'typescript.js');
	const tsserver = path.join(lib, 'tsserver.js');

	if (fs.existsSync(tsserverlibrary)) {
		return tsserverlibrary;
	}
	if (fs.existsSync(typescript)) {
		return typescript;
	}
	if (fs.existsSync(tsserver)) {
		return tsserver;
	}
}

export function findTypescriptLocalizedPathInLib(lib: string, lang: string) {

	const localized = path.join(lib, lang, 'diagnosticMessages.generated.json');

	if (fs.existsSync(localized)) {
		return localized;
	}
}

export function getVscodeTypescriptPath(appRoot: string) {
	return path.join(appRoot, 'extensions', 'node_modules', 'typescript', 'lib', 'typescript.js');
}

export function getVscodeTypescriptLocalizedPath(appRoot: string, lang: string): string | undefined {
	const tsPath = path.join(appRoot, 'extensions', 'node_modules', 'typescript', 'lib', lang, 'diagnosticMessages.generated.json');
	if (fs.existsSync(tsPath)) {
		return tsPath;
	}
}

export function getTypeScriptVersion(serverPath: string): string | undefined {
	if (!fs.existsSync(serverPath)) {
		return undefined;
	}

	const p = serverPath.split(path.sep);
	if (p.length <= 2) {
		return undefined;
	}
	const p2 = p.slice(0, -2);
	const modulePath = p2.join(path.sep);
	let fileName = path.join(modulePath, 'package.json');
	if (!fs.existsSync(fileName)) {
		// Special case for ts dev versions
		if (path.basename(modulePath) === 'built') {
			fileName = path.join(modulePath, '..', 'package.json');
		}
	}
	if (!fs.existsSync(fileName)) {
		return undefined;
	}

	const contents = fs.readFileSync(fileName).toString();
	let desc: any = null;
	try {
		desc = JSON.parse(contents);
	} catch (err) {
		return undefined;
	}
	if (!desc || !desc.version) {
		return undefined;
	}
	return desc.version;
}

export function createParsedCommandLine(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	parseConfigHost: ts.ParseConfigHost,
	tsConfig: string,
	extendsSet = new Set<string>(),
): ts.ParsedCommandLine & {
	vueOptions: {
		experimentalCompatMode?: 2 | 3;
		experimentalTemplateCompilerOptions?: any;
		experimentalTemplateCompilerOptionsRequirePath?: string;
	}
} {

	const realTsConfig = ts.sys.realpath!(tsConfig);
	const config = ts.readJsonConfigFile(realTsConfig, ts.sys.readFile);
	const content = ts.parseJsonSourceFileConfigFileContent(config, parseConfigHost, path.dirname(realTsConfig), {}, path.basename(realTsConfig));
	content.options.outDir = undefined; // TODO: patching ts server broke with outDir + rootDir + composite/incremental
	content.fileNames = content.fileNames.map(normalizeFileName);

	let baseVueOptions = {};
	const folder = path.dirname(tsConfig);

	extendsSet.add(tsConfig);

	if (content.raw.extends) {
		const extendsPath = require.resolve(content.raw.extends, { paths: [folder] });
		if (!extendsSet.has(extendsPath)) {
			baseVueOptions = createParsedCommandLine(ts, parseConfigHost, extendsPath, extendsSet).vueOptions;
		}
	}

	return {
		...content,
		vueOptions: {
			...baseVueOptions,
			...resolveVueCompilerOptions(content.raw.vueCompilerOptions ?? {}, folder),
		},
	};
}

function resolveVueCompilerOptions(rawOptions: {
	[key: string]: any,
	experimentalTemplateCompilerOptionsRequirePath?: string,
}, rootPath: string) {

	const result = { ...rawOptions };

	let templateOptionsPath = rawOptions.experimentalTemplateCompilerOptionsRequirePath;
	if (templateOptionsPath) {
		if (!path.isAbsolute(templateOptionsPath)) {
			templateOptionsPath = require.resolve(templateOptionsPath, { paths: [rootPath] });
		}
		try {
			result.experimentalTemplateCompilerOptions = require(templateOptionsPath).default;
		} catch (error) {
			console.log('Failed to require "experimentalTemplateCompilerOptionsRequirePath":', templateOptionsPath);
			console.error(error);
		}
	}

	return result;
}
