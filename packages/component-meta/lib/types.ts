import type { Checker, Printer, Type } from 'typescript-7/async' with { 'resolution-mode': 'import' };

export type TypeScript =
	& typeof import('typescript-7/ast', { with: { 'resolution-mode': 'import' }})
	& typeof import('typescript-7/async', { with: { 'resolution-mode': 'import' }});

/** The TypeScript 7 module and the printer of the `API` instance that created the project's snapshot. */
export interface ComponentMetaContext {
	ts: TypeScript;
	printer: Printer;
}

export type ComponentMetaChecker = Awaited<ReturnType<typeof import('../index')['createChecker']>>;

/** A declaration's range in UTF-16 offsets of the file's source text (for a Vue file, its `.vue` text). */
export interface Declaration {
	file: string;
	start: number;
	end: number;
}

export interface ComponentMeta {
	name?: string;
	description?: string;
	type: TypeMeta;
	props: PropertyMeta[];
	events: EventMeta[];
	slots: SlotMeta[];
	exposed: ExposeMeta[];
}

export enum TypeMeta {
	Unknown = 0,
	Class = 1,
	Function = 2,
}

export interface PropertyMeta {
	name: string;
	description: string;
	type: string;
	default?: string;
	global: boolean;
	required: boolean;
	tags: { name: string; text?: string }[];
	schema: PropertyMetaSchema;
	declarations: Declaration[];
}

export interface EventMeta {
	name: string;
	description: string;
	type: string;
	signature: string;
	tags: { name: string; text?: string }[];
	schema: PropertyMetaSchema[];
	declarations: Declaration[];
}

export interface SlotMeta {
	name: string;
	description: string;
	type: string;
	tags: { name: string; text?: string }[];
	schema: PropertyMetaSchema;
	declarations: Declaration[];
}

export interface ExposeMeta {
	name: string;
	description: string;
	type: string;
	tags: { name: string; text?: string }[];
	schema: PropertyMetaSchema;
	declarations: Declaration[];
}

export type PropertyMetaSchema =
	| string
	| { kind: 'literal'; type: string; value: string }
	| { kind: 'enum'; type: string; schema?: PropertyMetaSchema[] }
	| { kind: 'array'; type: string; schema?: PropertyMetaSchema[] }
	| { kind: 'event'; type: string; schema?: PropertyMetaSchema[] }
	| { kind: 'object'; type: string; schema?: Record<string, PropertyMeta> };

export type MetaCheckerSchemaOptions = boolean | {
	/**
	 * A list of type names to be ignored in expending in schema.
	 * Can be functions to ignore types dynamically.
	 */
	ignore?: (
		| string
		| ((
			name: string,
			type: Type,
			typeChecker: Checker,
		) => boolean | void | undefined | null | Promise<boolean | void | undefined | null>)
	)[];
};

export interface MetaCheckerOptions {
	schema?: MetaCheckerSchemaOptions;
}
