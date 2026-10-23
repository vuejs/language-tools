type Response<T> = T | null | undefined | Promise<T | null | undefined>;

/** An edit in UTF-16 offsets of a file's source text. */
export interface TextEdit {
	pos: number;
	end: number;
	newText: string;
}

/** A value a module of the project exports. */
export interface AutoImportExport {
	/** The name the value is imported and used as. */
	name: string;
	fileName: string;
	exportName: string;
	/** `fileName` relative to the project's current directory. */
	description: string;
	kind: 'class' | 'function' | 'variable';
}

/** A component a module of the project exports. */
export type AutoImportComponent = AutoImportExport;

export interface ComponentPropInfo {
	name: string;
	description?: string;
	optional?: boolean;
	boolean?: boolean;
}

/** A quick fix that imports an unresolved name. */
export interface ImportFix {
	title: string;
	edits: readonly TextEdit[];
}

/** A location in a file's source text. */
export interface DefinitionLocation {
	fileName: string;
	range: {
		start: { line: number; character: number };
		end: { line: number; character: number };
	};
}

export interface ExtractPropsInfo {
	name: string;
	type: string;
	model: boolean;
}

export interface Requests {
	collectExtractProps(
		fileName: string,
		templateCodeRange: [number, number],
	): Response<ExtractPropsInfo[]>;
	/** Edits in UTF-16 offsets of `fileName`'s source text that add a default import of `incomingFileName`. */
	getDefaultImportEdits(
		fileName: string,
		incomingFileName: string,
	): Response<readonly TextEdit[]>;
	isRefAtPosition(
		fileName: string,
		position: number,
	): Response<boolean>;
	getComponentDirectives(
		fileName: string,
	): Response<string[]>;
	getComponentMeta(
		fileName: string,
		tag: string,
	): Response<import('vue-component-meta').ComponentMeta>;
	getComponentNames(
		fileName: string,
	): Response<string[]>;
	getComponentProps(
		fileName: string,
		position: number,
	): Response<ComponentPropInfo[]>;
	getComponentSlots(
		fileName: string,
	): Response<string[]>;
	getElementAttrs(
		fileName: string,
		tag: string,
	): Response<ComponentPropInfo[]>;
	getElementNames(
		fileName: string,
	): Response<string[]>;
	/** The components that the modules of `fileName`'s project, other than external libraries, export. */
	getAutoImportComponents(
		fileName: string,
	): Response<AutoImportComponent[]>;
	/** The named value exports of the modules of `fileName`'s project, other than external libraries. */
	getAutoImportValues(
		fileName: string,
	): Response<AutoImportExport[]>;
	/** Edits that import `component`, or any other value export, into the Vue file `fileName` under its `name`. */
	getComponentImportEdits(
		fileName: string,
		component: AutoImportComponent,
	): Response<readonly TextEdit[]>;
	/**
	 * Quick fixes that import, into the Vue file `fileName`, the components named like `tag` when it resolves to no
	 * component, otherwise the named exports of the unresolved name at `position` of the template.
	 */
	getImportFixes(
		fileName: string,
		position: number,
		tag: string | undefined,
	): Response<ImportFix[]>;
	/** The declaration of the component `tag` refers to, when another file declares it. */
	getComponentDefinition(
		fileName: string,
		tag: string,
	): Response<DefinitionLocation>;
}
