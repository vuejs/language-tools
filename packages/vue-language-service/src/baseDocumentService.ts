import * as autoInsert from './documentFeatures/autoInsert';
import * as colorPresentations from './documentFeatures/colorPresentations';
import * as documentColors from './documentFeatures/documentColors';
import * as documentSymbols from './documentFeatures/documentSymbols';
import * as foldingRanges from './documentFeatures/foldingRanges';
import * as format from './documentFeatures/format';
import * as linkedEditingRanges from './documentFeatures/linkedEditingRanges';
import * as selectionRanges from './documentFeatures/selectionRanges';
import { DocumentServiceRuntimeContext } from './types';

// fix build
import type * as _0 from 'vscode-languageserver-protocol';
import type * as _1 from 'vscode-languageserver-textdocument';

export function getEmbeddedTypeScriptDocumentService(context: DocumentServiceRuntimeContext) {

	return {
		format: format.register(context),
		getFoldingRanges: foldingRanges.register(context),
		getSelectionRanges: selectionRanges.register(context),
		findLinkedEditingRanges: linkedEditingRanges.register(context),
		findDocumentSymbols: documentSymbols.register(context),
		findDocumentColors: documentColors.register(context),
		getColorPresentations: colorPresentations.register(context),
		doAutoInsert: autoInsert.register(context),
	};
}
