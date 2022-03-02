import type * as vscode from 'vscode-languageserver-protocol';
import * as callHierarchy from './services/callHierarchy';
import * as codeActions from './services/codeAction';
import * as codeActionResolve from './services/codeActionResolve';
import * as completions from './services/completion';
import * as completionResolve from './services/completionResolve';
import * as d3 from './services/d3';
import * as definitions from './services/definition';
import * as diagnostics from './services/diagnostics';
import * as documentHighlight from './services/documentHighlight';
import * as documentLink from './services/documentLinks';
import * as hover from './services/hover';
import * as refAutoClose from './services/refAutoClose';
import * as references from './services/references';
import * as codeLens from './services/referencesCodeLens';
import * as codeLensResolve from './services/referencesCodeLensResolve';
import * as rename from './services/rename';
import * as semanticTokens from './services/semanticTokens';
import * as signatureHelp from './services/signatureHelp';
import * as tagNameCase from './services/tagNameCase';
import * as workspaceSymbol from './services/workspaceSymbol';
import { LanguageServiceHost, LanguageServiceRuntimeContext } from './types';
import { createTypeScriptRuntime } from './typescriptRuntime';

import type * as _0 from 'vscode-html-languageservice';

export interface LanguageService extends ReturnType<typeof createLanguageService> { }

export function createLanguageService(
	{ typescript: ts }: { typescript: typeof import('typescript/lib/tsserverlibrary') },
	vueHost: LanguageServiceHost,
) {

	const tsRuntime = createTypeScriptRuntime({ typescript: ts }, vueHost, false);
	const blockingRequests = new Set<Promise<any>>();
	const context: LanguageServiceRuntimeContext = {
		...tsRuntime.context,
		getTextDocument: tsRuntime.getHostDocument,
	};
	const _callHierarchy = callHierarchy.register(context);
	const findDefinition = definitions.register(context);
	const renames = rename.register(context);

	return {
		doValidation: publicApiHook(diagnostics.register(context, () => tsRuntime.update(true)), false, false),
		findDefinition: publicApiHook(findDefinition.on, isTemplateScriptPosition),
		findReferences: publicApiHook(references.register(context), true),
		findTypeDefinition: publicApiHook(findDefinition.onType, isTemplateScriptPosition),
		callHierarchy: {
			doPrepare: publicApiHook(_callHierarchy.doPrepare, isTemplateScriptPosition),
			getIncomingCalls: publicApiHook(_callHierarchy.getIncomingCalls, true),
			getOutgoingCalls: publicApiHook(_callHierarchy.getOutgoingCalls, true),
		},
		prepareRename: publicApiHook(renames.prepareRename, isTemplateScriptPosition),
		doRename: publicApiHook(renames.doRename, true),
		getEditsForFileRename: publicApiHook(renames.onRenameFile, false),
		getSemanticTokens: publicApiHook(semanticTokens.register(context, () => tsRuntime.update(true)), false),

		doHover: publicApiHook(hover.register(context), isTemplateScriptPosition),
		doComplete: publicApiHook(completions.register(context, tsRuntime.getScriptContentVersion), isTemplateScriptPosition),

		getCodeActions: publicApiHook(codeActions.register(context), false),
		doCodeActionResolve: publicApiHook(codeActionResolve.register(context), false),
		doCompletionResolve: publicApiHook(completionResolve.register(context), false),
		doReferencesCodeLensResolve: publicApiHook(codeLensResolve.register(context), false),
		getSignatureHelp: publicApiHook(signatureHelp.register(context), false),
		getReferencesCodeLens: publicApiHook(codeLens.register(context), false),
		findDocumentHighlights: publicApiHook(documentHighlight.register(context), false),
		findDocumentLinks: publicApiHook(documentLink.register(context), false),
		findWorkspaceSymbols: publicApiHook(workspaceSymbol.register(context), false),
		dispose: () => {
			tsRuntime.dispose();
		},
		updateHtmlCustomData: tsRuntime.services.updateHtmlCustomData,
		updateCssCustomData: tsRuntime.services.updateCssCustomData,

		__internal__: {
			tsRuntime,
			rootPath: vueHost.getCurrentDirectory(),
			context,
			getContext: publicApiHook(() => context),
			getD3: publicApiHook(d3.register(context)),
			detectTagNameCase: publicApiHook(tagNameCase.register(context)),
			doRefAutoClose: publicApiHook(refAutoClose.register(context), false),
		},
	};

	function isTemplateScriptPosition(uri: string, pos: vscode.Position) {

		const sourceFile = tsRuntime.context.sourceFiles.get(uri);
		if (!sourceFile) {
			return false;
		}

		for (const sourceMap of sourceFile.getTsSourceMaps()) {
			if (sourceMap.lsType === 'script')
				continue;
			for (const _ of sourceMap.getMappedRanges(pos, pos, data =>
				data.vueTag === 'template'
				|| data.vueTag === 'style' // handle CSS variable injection to fix https://github.com/johnsoncodehk/volar/issues/777
			)) {
				return true;
			}
		}

		for (const sourceMap of sourceFile.getTemplateSourceMaps()) {
			for (const _ of sourceMap.getMappedRanges(pos)) {
				return true;
			}
		}

		return false;
	}
	function publicApiHook<T extends (...args: any) => any>(
		api: T,
		shouldUpdateTemplateScript: boolean | ((...args: Parameters<T>) => boolean) = true,
		blockNewRequest = true,
	): (...args: Parameters<T>) => Promise<ReturnType<T>> {
		const handler = {
			async apply(target: (...args: any) => any, thisArg: any, argumentsList: Parameters<T>) {
				for (const runningRequest of blockingRequests) {
					await runningRequest;
				}
				const _shouldUpdateTemplateScript = typeof shouldUpdateTemplateScript === 'boolean' ? shouldUpdateTemplateScript : shouldUpdateTemplateScript.apply(null, argumentsList);
				tsRuntime.update(_shouldUpdateTemplateScript);
				const runner = target.apply(thisArg, argumentsList);
				if (blockNewRequest && runner instanceof Promise) {
					blockingRequests.add(runner);
					runner.then(() => blockingRequests.delete(runner));
				}
				return runner;
			}
		};
		return new Proxy<T>(api, handler);
	}
}
