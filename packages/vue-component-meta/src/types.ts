

export interface ComponentMeta {
	props: PropertyMeta[];
	events: EventMeta[];
	slots: SlotMeta[];
	exposed: ExposeMeta[];
}
export interface PropertyMeta {
	name: string;
	default?: string;
	description: string;
	global: boolean;
	required: boolean;
	type: string;
	tags: { name: string, text?: string; }[];
	schema?: PropertyMetaSchema;
};
export interface EventMeta {
	name: string;
	type: string;
	signature: string;
	schema?: PropertyMetaSchema[];
}
export interface SlotMeta {
	name: string;
	type: string;
	description: string;
	schema?: PropertyMetaSchema;
}
export interface ExposeMeta {
	name: string;
	description: string;
	type: string;
	schema?: PropertyMetaSchema;
}

export type PropertyMetaSchema = string
	| { kind: 'enum', type: string, schema?: PropertyMetaSchema[]; }
	| { kind: 'array', type: string, schema?: PropertyMetaSchema[]; }
	| { kind: 'event', type: string, schema?: PropertyMetaSchema[]; }
	| { kind: 'object', type: string, schema?: Record<string, PropertyMeta>; };

export type MetaCheckerSchemaOptions = boolean | {
	ignore?: string[];
}
export interface MetaCheckerOptions {
	schema?: MetaCheckerSchemaOptions;
	forceUseTs?: boolean;
	printer?: import('typescript').PrinterOptions;
}
