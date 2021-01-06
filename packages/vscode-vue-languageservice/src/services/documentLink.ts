import {
	Range,
	TextDocument,
	DocumentLink,
} from 'vscode-languageserver/node';
import { SourceFile } from '../sourceFiles';
import * as jsonc from 'jsonc-parser';
import { uriToFsPath, fsPathToUri } from '@volar/shared';
import * as upath from 'upath';
import type * as ts from 'typescript';
import { notEmpty } from '../utils/commons';
import * as globalServices from '../globalServices';
import { getTypescript } from '@volar/vscode-builtin-packages';

export function register(sourceFiles: Map<string, SourceFile>, vueHost: ts.LanguageServiceHost) {
	const ts = getTypescript();
	return (document: TextDocument) => {
		const sourceFile = sourceFiles.get(document.uri);
		if (!sourceFile) return;

		const compilerHost = ts.createCompilerHost(vueHost.getCompilationSettings());
		const documentContext = {
			resolveReference: (ref: string, base: string) => {
				return resolvePath(ref, base);
			},
		}

		const tsResult = getTsResult(sourceFile);
		const htmlResult = getHtmlResult(sourceFile);
		const cssResult = getCssResult(sourceFile);
		return [...cssResult, ...htmlResult, ...tsResult];

		function getTsResult(sourceFile: SourceFile) {
			let result: DocumentLink[] = [];
			for (const sourceMap of sourceFile.getTsSourceMaps()) {
				// TODO: move to vscode-typescript-languageservice
				const scriptContent = sourceMap.targetDocument.getText();
				const root = jsonc.parseTree(scriptContent);
				if (!root) continue;
				const scriptDoc = TextDocument.create(document.uri, 'typescript', 0, scriptContent);

				result = result.concat([
					getExtendsLink(scriptDoc, root),
					...getFilesLinks(scriptDoc, root),
					...getReferencesLinks(scriptDoc, root)
				].filter(notEmpty));
			}
			return result;

			function getExtendsLink(document: TextDocument, root: jsonc.Node): DocumentLink | undefined {
				const extendsNode = jsonc.findNodeAtLocation(root, ['extends']);
				if (!isPathValue(extendsNode)) {
					return undefined;
				}

				if (extendsNode.value.startsWith('.')) {
					return DocumentLink.create(
						getRange(document, extendsNode),
						fsPathToUri(upath.join(upath.dirname(uriToFsPath(document.uri)), extendsNode.value + (extendsNode.value.endsWith('.json') ? '' : '.json')))
					);
				}

				const workspaceFolderPath = vueHost.getCurrentDirectory();
				return DocumentLink.create(
					getRange(document, extendsNode),
					fsPathToUri(upath.join(workspaceFolderPath, 'node_modules', extendsNode.value + (extendsNode.value.endsWith('.json') ? '' : '.json')))
				);
			}
			function getFilesLinks(document: TextDocument, root: jsonc.Node) {
				return mapChildren(
					jsonc.findNodeAtLocation(root, ['files']),
					child => pathNodeToLink(document, child));
			}
			function getReferencesLinks(document: TextDocument, root: jsonc.Node) {
				return mapChildren(
					jsonc.findNodeAtLocation(root, ['references']),
					child => {
						const pathNode = jsonc.findNodeAtLocation(child, ['path']);
						if (!isPathValue(pathNode)) {
							return undefined;
						}

						return DocumentLink.create(getRange(document, pathNode),
							upath.basename(pathNode.value).endsWith('.json')
								? getFileTarget(document, pathNode)
								: getFolderTarget(document, pathNode));
					});
			}
			function pathNodeToLink(
				document: TextDocument,
				node: jsonc.Node | undefined
			): DocumentLink | undefined {
				return isPathValue(node)
					? DocumentLink.create(getRange(document, node), getFileTarget(document, node))
					: undefined;
			}
			function isPathValue(extendsNode: jsonc.Node | undefined): extendsNode is jsonc.Node {
				return extendsNode
					&& extendsNode.type === 'string'
					&& extendsNode.value
					&& !(extendsNode.value as string).includes('*'); // don't treat globs as links.
			}
			function getFileTarget(document: TextDocument, node: jsonc.Node): string {
				return fsPathToUri(upath.join(upath.dirname(uriToFsPath(document.uri)), node!.value));
			}
			function getFolderTarget(document: TextDocument, node: jsonc.Node): string {
				return fsPathToUri(upath.join(upath.dirname(uriToFsPath(document.uri)), node!.value, 'tsconfig.json'));
			}
			function getRange(document: TextDocument, node: jsonc.Node) {
				const offset = node!.offset;
				const start = document.positionAt(offset + 1);
				const end = document.positionAt(offset + (node!.length - 1));
				return Range.create(start, end);
			}
			function mapChildren<R>(node: jsonc.Node | undefined, f: (x: jsonc.Node) => R): R[] {
				return node && node.type === 'array' && node.children
					? node.children.map(f)
					: [];
			}
		}
		function getHtmlResult(sourceFile: SourceFile) {
			const result: DocumentLink[] = [];
			for (const sourceMap of sourceFile.getHtmlSourceMaps()) {
				const links = globalServices.html.findDocumentLinks(sourceMap.targetDocument, documentContext);
				for (const link of links) {
					const vueLoc = sourceMap.targetToSource(link.range);
					if (vueLoc) {
						result.push({
							...link,
							range: vueLoc.range,
						});
					}
				}
			}
			return result;
		}
		function getCssResult(sourceFile: SourceFile) {
			const sourceMaps = sourceFile.getCssSourceMaps();
			const result: DocumentLink[] = [];
			for (const sourceMap of sourceMaps) {
				const cssLanguageService = globalServices.getCssService(sourceMap.targetDocument.languageId);
				const links = cssLanguageService.findDocumentLinks(sourceMap.targetDocument, sourceMap.stylesheet, documentContext);
				for (const link of links) {
					const vueLoc = sourceMap.targetToSource(link.range);
					if (vueLoc) {
						result.push({
							...link,
							range: vueLoc.range,
						});
					}
				}
			}
			return result;
		}
		function resolvePath(ref: string, base: string) {
			const resolveResult = ts.resolveModuleName(ref, base, vueHost.getCompilationSettings(), compilerHost);
			const failedLookupLocations: string[] = (resolveResult as any).failedLookupLocations;

			for (const failed of failedLookupLocations) {
				let path = failed;
				if (path.endsWith('.d.ts')) {
					path = upath.trimExt(path);
					path = upath.trimExt(path);
				}
				else {
					path = upath.trimExt(path);
				}
				if (ts.sys.fileExists(uriToFsPath(path))) {
					return path;
				}
			}

			return ref;
		}
	}
}
