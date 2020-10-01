/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Helpers for converting FROM vscode types TO ts types
 */

import * as vscode from 'vscode-languageserver';
import type * as Proto from '../protocol';
import * as PConst from '../protocol.const';

export namespace SymbolKind {
	export function fromProtocolScriptElementKind(kind: Proto.ScriptElementKind) {
		switch (kind) {
			case PConst.Kind.module: return vscode.SymbolKind.Module;
			case PConst.Kind.class: return vscode.SymbolKind.Class;
			case PConst.Kind.enum: return vscode.SymbolKind.Enum;
			case PConst.Kind.enumMember: return vscode.SymbolKind.EnumMember;
			case PConst.Kind.interface: return vscode.SymbolKind.Interface;
			case PConst.Kind.indexSignature: return vscode.SymbolKind.Method;
			case PConst.Kind.callSignature: return vscode.SymbolKind.Method;
			case PConst.Kind.method: return vscode.SymbolKind.Method;
			case PConst.Kind.memberVariable: return vscode.SymbolKind.Property;
			case PConst.Kind.memberGetAccessor: return vscode.SymbolKind.Property;
			case PConst.Kind.memberSetAccessor: return vscode.SymbolKind.Property;
			case PConst.Kind.variable: return vscode.SymbolKind.Variable;
			case PConst.Kind.let: return vscode.SymbolKind.Variable;
			case PConst.Kind.const: return vscode.SymbolKind.Variable;
			case PConst.Kind.localVariable: return vscode.SymbolKind.Variable;
			case PConst.Kind.alias: return vscode.SymbolKind.Variable;
			case PConst.Kind.function: return vscode.SymbolKind.Function;
			case PConst.Kind.localFunction: return vscode.SymbolKind.Function;
			case PConst.Kind.constructSignature: return vscode.SymbolKind.Constructor;
			case PConst.Kind.constructorImplementation: return vscode.SymbolKind.Constructor;
			case PConst.Kind.typeParameter: return vscode.SymbolKind.TypeParameter;
			case PConst.Kind.string: return vscode.SymbolKind.String;
			default: return vscode.SymbolKind.Variable;
		}
	}
}
