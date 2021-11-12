import * as vscode from 'vscode-languageserver';
import type { PugDocument, Node } from '../pugDocument';

export function register() {
	return (pugDoc: PugDocument): vscode.FoldingRange[] => {

		const result: vscode.FoldingRange[] = [];
		const docEndPos = pugDoc.pugTextDocument.positionAt(pugDoc.pugTextDocument.getText().length);

		if (pugDoc.ast) {
			visitNode(pugDoc.ast, findMinimalEndLine(docEndPos.line));
		}

		return result;

		function visitNode(node: Node, endLine: number) {
			if (node.type === 'Block') {
				for (let i = 0; i < node.nodes.length; i++) {
					const child = node.nodes[i];
					const next = i + 1 < node.nodes.length ? node.nodes[i + 1] : undefined;
					visitNode(child, next ? findMinimalEndLine(next.line - 2) : endLine);
				}
			}
			else if (node.type === 'Tag' || node.type === 'BlockComment') {
				const nodeLine = node.line - 1; // one base to zero base
				if (nodeLine !== endLine) {
					result.push(vscode.FoldingRange.create(
						nodeLine,
						endLine,
						undefined,
						undefined,
						node.type === 'BlockComment' ? vscode.FoldingRangeKind.Comment : undefined,
					));
				}
				visitNode(node.block, endLine);
			}
		}
		function findMinimalEndLine(endLine: number) {
			while (endLine > 0 && getLineText(endLine).trim() === '') {
				console.log(endLine, getLineText(endLine));
				endLine--;
			}
			return endLine;
		}
		function getLineText(line: number) {
			if (line === docEndPos.line) {
				return pugDoc.pugTextDocument.getText({
					start: { line: line, character: 0 },
					end: docEndPos,
				});
			}
			const text = pugDoc.pugTextDocument.getText({
				start: { line: line, character: 0 },
				end: { line: line + 1, character: 0 },
			});
			return text.substring(0, text.length - 1);
		}
	}
}
