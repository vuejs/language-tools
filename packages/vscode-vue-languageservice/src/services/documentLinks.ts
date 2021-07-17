import * as shared from '@volar/shared';
import * as jsonc from 'jsonc-parser';
import * as upath from 'upath';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as vscode from 'vscode-languageserver';
import type { SourceFile } from '../sourceFile';
import type { ApiLanguageServiceContext } from '../types';

export function register({ documentContext, sourceFiles, vueHost, htmlLs, pugLs, getCssLs }: ApiLanguageServiceContext) {
	return async (uri: string) => {
		const sourceFile = sourceFiles.get(uri);
		if (!sourceFile) return;

		const document = sourceFile.getTextDocument();
		const tsResult = getTsResult(sourceFile);
		const tsResult2 = getTsResult2(sourceFile);
		const htmlResult = getHtmlResult(sourceFile);
		const cssResult = await getCssResult(sourceFile);

		return [
			...cssResult,
			...htmlResult,
			...tsResult,
			...tsResult2,
		];

		function getTsResult(sourceFile: SourceFile) {
			let result: vscode.DocumentLink[] = [];
			for (const sourceMap of sourceFile.getTsSourceMaps()) {
				// TODO: capabilities
				// TODO: move to vscode-typescript-languageservice
				const scriptContent = sourceMap.mappedDocument.getText();
				const root = jsonc.parseTree(scriptContent);
				if (!root) continue;
				const scriptDoc = TextDocument.create(uri, 'typescript', 0, scriptContent);

				result = result.concat([
					getExtendsLink(scriptDoc, root),
					...getFilesLinks(scriptDoc, root),
					...getReferencesLinks(scriptDoc, root)
				].filter(shared.notEmpty));
			}
			return result;

			function getExtendsLink(document: TextDocument, root: jsonc.Node): vscode.DocumentLink | undefined {
				const extendsNode = jsonc.findNodeAtLocation(root, ['extends']);
				if (!isPathValue(extendsNode)) {
					return undefined;
				}

				if (extendsNode.value.startsWith('.')) {
					return vscode.DocumentLink.create(
						getRange(document, extendsNode),
						shared.fsPathToUri(upath.join(upath.dirname(shared.uriToFsPath(document.uri)), extendsNode.value + (extendsNode.value.endsWith('.json') ? '' : '.json')))
					);
				}

				const workspaceFolderPath = vueHost.getCurrentDirectory();
				return vscode.DocumentLink.create(
					getRange(document, extendsNode),
					shared.fsPathToUri(upath.join(workspaceFolderPath, 'node_modules', extendsNode.value + (extendsNode.value.endsWith('.json') ? '' : '.json')))
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

						return vscode.DocumentLink.create(getRange(document, pathNode),
							upath.basename(pathNode.value).endsWith('.json')
								? getFileTarget(document, pathNode)
								: getFolderTarget(document, pathNode));
					});
			}
			function pathNodeToLink(
				document: TextDocument,
				node: jsonc.Node | undefined
			): vscode.DocumentLink | undefined {
				return isPathValue(node)
					? vscode.DocumentLink.create(getRange(document, node), getFileTarget(document, node))
					: undefined;
			}
			function isPathValue(extendsNode: jsonc.Node | undefined): extendsNode is jsonc.Node {
				return extendsNode
					&& extendsNode.type === 'string'
					&& extendsNode.value
					&& !(extendsNode.value as string).includes('*'); // don't treat globs as links.
			}
			function getFileTarget(document: TextDocument, node: jsonc.Node): string {
				return shared.fsPathToUri(upath.join(upath.dirname(shared.uriToFsPath(document.uri)), node!.value));
			}
			function getFolderTarget(document: TextDocument, node: jsonc.Node): string {
				return shared.fsPathToUri(upath.join(upath.dirname(shared.uriToFsPath(document.uri)), node!.value, 'tsconfig.json'));
			}
			function getRange(document: TextDocument, node: jsonc.Node) {
				const offset = node!.offset;
				const start = document.positionAt(offset + 1);
				const end = document.positionAt(offset + (node!.length - 1));
				return vscode.Range.create(start, end);
			}
			function mapChildren<R>(node: jsonc.Node | undefined, f: (x: jsonc.Node) => R): R[] {
				return node && node.type === 'array' && node.children
					? node.children.map(f)
					: [];
			}
		}
		function getTsResult2(sourceFile: SourceFile) {
			const result: vscode.DocumentLink[] = [];
			for (const sourceMap of sourceFile.getTsSourceMaps()) {
				for (const maped of sourceMap) {
					if (!maped.data.capabilities.displayWithLink) {
						continue;
					}
					result.push({
						range: {
							start: document.positionAt(maped.sourceRange.start),
							end: document.positionAt(maped.sourceRange.end),
						},
						target: uri, // TODO
					});
				}
			}
			return result;
		}
		function getHtmlResult(sourceFile: SourceFile) {
			const result: vscode.DocumentLink[] = [];
			for (const sourceMap of [...sourceFile.getHtmlSourceMaps(), ...sourceFile.getPugSourceMaps()]) {
				const links = sourceMap.language === 'html'
					? htmlLs.findDocumentLinks(sourceMap.mappedDocument, documentContext)
					: pugLs.findDocumentLinks(sourceMap.pugDocument, documentContext)
				for (const link of links) {
					const vueRange = sourceMap.getSourceRange(link.range.start, link.range.end);
					if (vueRange) {
						result.push({
							...link,
							range: vueRange,
						});
					}
				}
			}
			return result;
		}
		async function getCssResult(sourceFile: SourceFile) {
			const sourceMaps = sourceFile.getCssSourceMaps();
			const result: vscode.DocumentLink[] = [];
			for (const sourceMap of sourceMaps) {
				const cssLs = getCssLs(sourceMap.mappedDocument.languageId);
				if (!cssLs || !sourceMap.stylesheet) continue;
				const links = await cssLs.findDocumentLinks2(sourceMap.mappedDocument, sourceMap.stylesheet, documentContext);
				for (const link of links) {
					const vueRange = sourceMap.getSourceRange(link.range.start, link.range.end);
					if (vueRange) {
						result.push({
							...link,
							range: vueRange,
						});
					}
				}
			}
			return result;
		}
	}
}
