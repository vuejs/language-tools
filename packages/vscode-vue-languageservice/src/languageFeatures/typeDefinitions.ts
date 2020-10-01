import {
	Position,
	TextDocument,
} from 'vscode-languageserver';
import { SourceFile } from '../sourceFiles';
import { tsDefinitionWorker } from './definitions';

export function register(sourceFiles: Map<string, SourceFile>) {
	return (document: TextDocument, position: Position) => {
		const sourceFile = sourceFiles.get(document.uri);
		if (!sourceFile) return;
		const tsResult = tsDefinitionWorker(sourceFile, position, sourceFiles, true);
		return tsResult;
	}
}
