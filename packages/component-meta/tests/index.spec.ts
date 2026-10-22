import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';
import {
	createChecker,
	type Declaration,
	getComponentMeta,
	getExportNames,
	type MetaCheckerOptions,
	TypeMeta,
} from '..';

const checkerOptions: MetaCheckerOptions = {
	schema: { ignore: ['MyIgnoredNestedProps'] },
};
const workspace = path.resolve(__dirname, '../../../test-workspace/component-meta');

/** Replaces each declaration with its file relative to the workspace and its source text, ignoring line endings. */
function toPortable<T>(value: T): T {
	if (Array.isArray(value)) {
		return value.map(toPortable) as T;
	}
	if (value && typeof value === 'object') {
		if ('file' in value && 'start' in value && 'end' in value) {
			const { file, start, end } = value as Declaration;
			const relative = path.relative(workspace, file);
			if (relative.startsWith('..')) {
				return path.basename(file) as T;
			}
			const text = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
			return `${relative.replace(/\\/g, '/')}: ${text.slice(start, end)}` as T;
		}
		return Object.fromEntries(Object.entries(value).map(([key, value]) => [key, toPortable(value)])) as T;
	}
	return value;
}

describe('vue-component-meta', async () => {
	const checker = await createChecker(path.join(workspace, 'tsconfig.json'), checkerOptions);
	afterAll(() => checker.close());
	const getMeta = async (fileName: string) => toPortable(await checker.getComponentMeta(fileName));

	test('empty-component', async () => {
		const componentPath = path.resolve(
			__dirname,
			'../../../test-workspace/component-meta/empty-component/component.vue',
		);
		const meta = await getMeta(componentPath);

		expect(meta.props.map(prop => prop.name)).toMatchInlineSnapshot(`
				[
				  "key",
				  "ref",
				  "ref_for",
				  "ref_key",
				  "onVue:beforeMount",
				  "onVue:mounted",
				  "onVue:beforeUpdate",
				  "onVue:updated",
				  "onVue:beforeUnmount",
				  "onVue:unmounted",
				  "class",
				  "style",
				]
			`);
		expect(meta.props.filter(prop => !prop.global)).toEqual([]);
	});

	test('reference-type-model', async () => {
		const componentPath = path.resolve(
			__dirname,
			'../../../test-workspace/component-meta/reference-type-model/component.vue',
		);
		const meta = await getMeta(componentPath);

		expect(meta.type).toEqual(TypeMeta.Class);

		const modelValue = meta.props.find(prop => prop.name === 'modelValue');
		const onUpdateModelValue = meta.events.find(event => event.name === 'update:modelValue');

		expect(modelValue).toMatchInlineSnapshot(`
			{
			  "declarations": [],
			  "default": undefined,
			  "description": "required number modelValue",
			  "global": false,
			  "name": "modelValue",
			  "required": true,
			  "schema": "number",
			  "tags": [],
			  "type": "number",
			}
		`);
		expect(onUpdateModelValue).toBeDefined();

		const foo = meta.props.find(prop => prop.name === 'foo');
		const onUpdateFoo = meta.events.find(event => event.name === 'update:foo');

		expect(foo).toMatchInlineSnapshot(`
			{
			  "declarations": [],
			  "default": "false",
			  "description": "optional boolean foo with default false",
			  "global": false,
			  "name": "foo",
			  "required": false,
			  "schema": {
			    "kind": "enum",
			    "schema": [
			      "undefined",
			      "false",
			      "true",
			    ],
			    "type": "boolean | undefined",
			  },
			  "tags": [],
			  "type": "boolean | undefined",
			}
		`);
		expect(onUpdateFoo).toBeDefined();

		const bar = meta.props.find(prop => prop.name === 'bar');
		const barModifiers = meta.props.find(prop => prop.name === 'barModifiers');
		const onUpdateBaz = meta.events.find(event => event.name === 'update:bar');

		expect(bar).toMatchInlineSnapshot(`
			{
			  "declarations": [],
			  "default": undefined,
			  "description": "optional string bar with lazy and trim modifiers",
			  "global": false,
			  "name": "bar",
			  "required": false,
			  "schema": {
			    "kind": "enum",
			    "schema": [
			      "undefined",
			      "string",
			    ],
			    "type": "string | undefined",
			  },
			  "tags": [],
			  "type": "string | undefined",
			}
		`);
		expect(barModifiers).toMatchInlineSnapshot(`
			{
			  "declarations": [],
			  "default": undefined,
			  "description": "",
			  "global": false,
			  "name": "barModifiers",
			  "required": false,
			  "schema": {
			    "kind": "enum",
			    "schema": [
			      "undefined",
			      "Partial<Record<"lazy" | "trim", true>>",
			    ],
			    "type": "Partial<Record<"lazy" | "trim", true>> | undefined",
			  },
			  "tags": [],
			  "type": "Partial<Record<"lazy" | "trim", true>> | undefined",
			}
		`);
		expect(onUpdateBaz).toBeDefined();
	});

	test('reference-type-props', async () => {
		const componentPath = path.resolve(
			__dirname,
			'../../../test-workspace/component-meta/reference-type-props/component.vue',
		);
		const meta = await getMeta(componentPath);

		expect(meta.type).toEqual(TypeMeta.Class);

		const foo = meta.props.find(prop => prop.name === 'foo');
		expect(foo).toMatchInlineSnapshot(`
			{
			  "declarations": [
			    "reference-type-props/my-props.ts: foo: string;",
			  ],
			  "default": undefined,
			  "description": "string foo",
			  "global": false,
			  "name": "foo",
			  "required": true,
			  "schema": "string",
			  "tags": [
			    {
			      "name": "default",
			      "text": ""rounded"",
			    },
			    {
			      "name": "since",
			      "text": "v1.0.0",
			    },
			    {
			      "name": "see",
			      "text": "https://vuejs.org/",
			    },
			    {
			      "name": "example",
			      "text": "\`\`\`vue
			<template>
			  <component foo="straight" />
			</template>
			\`\`\`",
			    },
			  ],
			  "type": "string",
			}
		`);

		const bar = meta.props.find(prop => prop.name === 'bar');
		expect(bar).toMatchInlineSnapshot(`
			{
			  "declarations": [
			    "reference-type-props/my-props.ts: bar?: number;",
			  ],
			  "default": "1",
			  "description": "optional number bar",
			  "global": false,
			  "name": "bar",
			  "required": false,
			  "schema": {
			    "kind": "enum",
			    "schema": [
			      "undefined",
			      "number",
			    ],
			    "type": "number | undefined",
			  },
			  "tags": [],
			  "type": "number | undefined",
			}
		`);

		const baz = meta.props.find(prop => prop.name === 'baz');
		expect(baz).toMatchInlineSnapshot(`
			{
			  "declarations": [
			    "reference-type-props/my-props.ts: baz?: string[];",
			  ],
			  "default": "['foo', 'bar']",
			  "description": "string array baz",
			  "global": false,
			  "name": "baz",
			  "required": false,
			  "schema": {
			    "kind": "enum",
			    "schema": [
			      "undefined",
			      {
			        "kind": "array",
			        "schema": [
			          "string",
			        ],
			        "type": "string[]",
			      },
			    ],
			    "type": "string[] | undefined",
			  },
			  "tags": [],
			  "type": "string[] | undefined",
			}
		`);

		const union = meta.props.find(prop => prop.name === 'union');
		expect(union).toMatchInlineSnapshot(`
			{
			  "declarations": [
			    "reference-type-props/my-props.ts: union: string | number;",
			  ],
			  "default": undefined,
			  "description": "required union type",
			  "global": false,
			  "name": "union",
			  "required": true,
			  "schema": {
			    "kind": "enum",
			    "schema": [
			      "string",
			      "number",
			    ],
			    "type": "string | number",
			  },
			  "tags": [],
			  "type": "string | number",
			}
		`);

		const unionOptional = meta.props.find(prop => prop.name === 'unionOptional');
		expect(unionOptional).toMatchInlineSnapshot(`
			{
			  "declarations": [
			    "reference-type-props/my-props.ts: unionOptional?: string | number;",
			  ],
			  "default": undefined,
			  "description": "optional union type",
			  "global": false,
			  "name": "unionOptional",
			  "required": false,
			  "schema": {
			    "kind": "enum",
			    "schema": [
			      "undefined",
			      "string",
			      "number",
			    ],
			    "type": "string | number | undefined",
			  },
			  "tags": [],
			  "type": "string | number | undefined",
			}
		`);

		const nested = meta.props.find(prop => prop.name === 'nested');
		expect(nested).toMatchInlineSnapshot(`
			{
			  "declarations": [
			    "reference-type-props/my-props.ts: nested: MyNestedProps;",
			  ],
			  "default": undefined,
			  "description": "required nested object",
			  "global": false,
			  "name": "nested",
			  "required": true,
			  "schema": {
			    "kind": "object",
			    "schema": {
			      "nestedProp": {
			        "declarations": [
			          "reference-type-props/my-props.ts: nestedProp: string;",
			        ],
			        "default": undefined,
			        "description": "nested prop documentation",
			        "global": false,
			        "name": "nestedProp",
			        "required": true,
			        "schema": "string",
			        "tags": [],
			        "type": "string",
			      },
			    },
			    "type": "MyNestedProps",
			  },
			  "tags": [],
			  "type": "MyNestedProps",
			}
		`);

		const nestedIntersection = meta.props.find(prop => prop.name === 'nestedIntersection');
		expect(nestedIntersection).toMatchInlineSnapshot(`
			{
			  "declarations": [
			    "reference-type-props/my-props.ts: nestedIntersection: MyNestedProps & {
					/**
					 * required additional property
					 */
					additionalProp: string;
				};",
			  ],
			  "default": undefined,
			  "description": "required nested object with intersection",
			  "global": false,
			  "name": "nestedIntersection",
			  "required": true,
			  "schema": {
			    "kind": "object",
			    "schema": {
			      "additionalProp": {
			        "declarations": [
			          "reference-type-props/my-props.ts: additionalProp: string;",
			        ],
			        "default": undefined,
			        "description": "required additional property",
			        "global": false,
			        "name": "additionalProp",
			        "required": true,
			        "schema": "string",
			        "tags": [],
			        "type": "string",
			      },
			      "nestedProp": {
			        "declarations": [
			          "reference-type-props/my-props.ts: nestedProp: string;",
			        ],
			        "default": undefined,
			        "description": "nested prop documentation",
			        "global": false,
			        "name": "nestedProp",
			        "required": true,
			        "schema": "string",
			        "tags": [],
			        "type": "string",
			      },
			    },
			    "type": "MyNestedProps & { additionalProp: string; }",
			  },
			  "tags": [],
			  "type": "MyNestedProps & { additionalProp: string; }",
			}
		`);

		const nestedOptional = meta.props.find(prop => prop.name === 'nestedOptional');
		expect(nestedOptional).toMatchInlineSnapshot(`
			{
			  "declarations": [
			    "reference-type-props/my-props.ts: nestedOptional?: MyNestedProps | MyIgnoredNestedProps;",
			  ],
			  "default": undefined,
			  "description": "optional nested object",
			  "global": false,
			  "name": "nestedOptional",
			  "required": false,
			  "schema": {
			    "kind": "enum",
			    "schema": [
			      "undefined",
			      "MyIgnoredNestedProps",
			      {
			        "kind": "object",
			        "schema": {
			          "nestedProp": {
			            "declarations": [
			              "reference-type-props/my-props.ts: nestedProp: string;",
			            ],
			            "default": undefined,
			            "description": "nested prop documentation",
			            "global": false,
			            "name": "nestedProp",
			            "required": true,
			            "schema": "string",
			            "tags": [],
			            "type": "string",
			          },
			        },
			        "type": "MyNestedProps",
			      },
			    ],
			    "type": "MyIgnoredNestedProps | MyNestedProps | undefined",
			  },
			  "tags": [],
			  "type": "MyIgnoredNestedProps | MyNestedProps | undefined",
			}
		`);

		const array = meta.props.find(prop => prop.name === 'array');
		expect(array).toMatchInlineSnapshot(`
			{
			  "declarations": [
			    "reference-type-props/my-props.ts: array: MyNestedProps[];",
			  ],
			  "default": undefined,
			  "description": "required array object",
			  "global": false,
			  "name": "array",
			  "required": true,
			  "schema": {
			    "kind": "array",
			    "schema": [
			      {
			        "kind": "object",
			        "schema": {
			          "nestedProp": {
			            "declarations": [
			              "reference-type-props/my-props.ts: nestedProp: string;",
			            ],
			            "default": undefined,
			            "description": "nested prop documentation",
			            "global": false,
			            "name": "nestedProp",
			            "required": true,
			            "schema": "string",
			            "tags": [],
			            "type": "string",
			          },
			        },
			        "type": "MyNestedProps",
			      },
			    ],
			    "type": "MyNestedProps[]",
			  },
			  "tags": [],
			  "type": "MyNestedProps[]",
			}
		`);

		const arrayOptional = meta.props.find(prop => prop.name === 'arrayOptional');
		expect(arrayOptional).toMatchInlineSnapshot(`
			{
			  "declarations": [
			    "reference-type-props/my-props.ts: arrayOptional?: MyNestedProps[];",
			  ],
			  "default": undefined,
			  "description": "optional array object",
			  "global": false,
			  "name": "arrayOptional",
			  "required": false,
			  "schema": {
			    "kind": "enum",
			    "schema": [
			      "undefined",
			      {
			        "kind": "array",
			        "schema": [
			          {
			            "kind": "object",
			            "schema": {
			              "nestedProp": {
			                "declarations": [
			                  "reference-type-props/my-props.ts: nestedProp: string;",
			                ],
			                "default": undefined,
			                "description": "nested prop documentation",
			                "global": false,
			                "name": "nestedProp",
			                "required": true,
			                "schema": "string",
			                "tags": [],
			                "type": "string",
			              },
			            },
			            "type": "MyNestedProps",
			          },
			        ],
			        "type": "MyNestedProps[]",
			      },
			    ],
			    "type": "MyNestedProps[] | undefined",
			  },
			  "tags": [],
			  "type": "MyNestedProps[] | undefined",
			}
		`);

		const enumValue = meta.props.find(prop => prop.name === 'enumValue');
		expect(enumValue).toMatchInlineSnapshot(`
			{
			  "declarations": [
			    "reference-type-props/my-props.ts: enumValue: MyEnum;",
			  ],
			  "default": undefined,
			  "description": "enum value",
			  "global": false,
			  "name": "enumValue",
			  "required": true,
			  "schema": {
			    "kind": "enum",
			    "schema": [
			      {
			        "kind": "literal",
			        "type": "MyEnum.Small",
			        "value": "0",
			      },
			      {
			        "kind": "literal",
			        "type": "MyEnum.Medium",
			        "value": "1",
			      },
			      {
			        "kind": "literal",
			        "type": "MyEnum.Large",
			        "value": "2",
			      },
			    ],
			    "type": "MyEnum",
			  },
			  "tags": [],
			  "type": "MyEnum",
			}
		`);

		const stringEnumValue = meta.props.find(prop => prop.name === 'stringEnumValue');
		expect(stringEnumValue).toMatchInlineSnapshot(`
			{
			  "declarations": [
			    "reference-type-props/my-props.ts: stringEnumValue: MyStringEnum;",
			  ],
			  "default": undefined,
			  "description": "string enum value",
			  "global": false,
			  "name": "stringEnumValue",
			  "required": true,
			  "schema": {
			    "kind": "enum",
			    "schema": [
			      {
			        "kind": "literal",
			        "type": "MyStringEnum.Small",
			        "value": ""small"",
			      },
			      {
			        "kind": "literal",
			        "type": "MyStringEnum.Medium",
			        "value": ""medium"",
			      },
			      {
			        "kind": "literal",
			        "type": "MyStringEnum.Large",
			        "value": ""large"",
			      },
			    ],
			    "type": "MyStringEnum",
			  },
			  "tags": [],
			  "type": "MyStringEnum",
			}
		`);

		const namespaceType = meta.props.find(prop => prop.name === 'namespaceType');
		expect(namespaceType).toMatchInlineSnapshot(`
			{
			  "declarations": [
			    "reference-type-props/my-props.ts: namespaceType: MyNamespace.MyType;",
			  ],
			  "default": undefined,
			  "description": "namespace type",
			  "global": false,
			  "name": "namespaceType",
			  "required": true,
			  "schema": {
			    "kind": "object",
			    "schema": {},
			    "type": "MyNamespace.MyType",
			  },
			  "tags": [],
			  "type": "MyNamespace.MyType",
			}
		`);

		const literalFromContext = meta.props.find(prop => prop.name === 'literalFromContext');
		expect(literalFromContext).toMatchInlineSnapshot(`
			{
			  "declarations": [
			    "reference-type-props/my-props.ts: literalFromContext: MyCategories;",
			  ],
			  "default": undefined,
			  "description": "literal type alias that require context",
			  "global": false,
			  "name": "literalFromContext",
			  "required": true,
			  "schema": {
			    "kind": "enum",
			    "schema": [
			      ""Addons"",
			      ""Content"",
			      ""Display"",
			      ""Forms"",
			      ""Interaction"",
			      ""Uncategorized"",
			    ],
			    "type": ""Addons" | "Content" | "Display" | "Forms" | "Interaction" | "Uncategorized"",
			  },
			  "tags": [],
			  "type": ""Addons" | "Content" | "Display" | "Forms" | "Interaction" | "Uncategorized"",
			}
		`);

		const inlined = meta.props.find(prop => prop.name === 'inlined');
		expect(inlined).toMatchInlineSnapshot(`
			{
			  "declarations": [
			    "reference-type-props/my-props.ts: inlined: { foo: string };",
			  ],
			  "default": undefined,
			  "description": "",
			  "global": false,
			  "name": "inlined",
			  "required": true,
			  "schema": {
			    "kind": "object",
			    "schema": {
			      "foo": {
			        "declarations": [
			          "reference-type-props/my-props.ts: foo: string",
			        ],
			        "default": undefined,
			        "description": "",
			        "global": false,
			        "name": "foo",
			        "required": true,
			        "schema": "string",
			        "tags": [],
			        "type": "string",
			      },
			    },
			    "type": "{ foo: string; }",
			  },
			  "tags": [],
			  "type": "{ foo: string; }",
			}
		`);

		const recursive = meta.props.find(prop => prop.name === 'recursive');
		expect(recursive).toMatchInlineSnapshot(`
			{
			  "declarations": [
			    "reference-type-props/my-props.ts: recursive: MyNestedRecursiveProps;",
			  ],
			  "default": undefined,
			  "description": "",
			  "global": false,
			  "name": "recursive",
			  "required": true,
			  "schema": {
			    "kind": "object",
			    "schema": {
			      "recursive": {
			        "declarations": [
			          "reference-type-props/my-props.ts: recursive: MyNestedRecursiveProps;",
			        ],
			        "default": undefined,
			        "description": "",
			        "global": false,
			        "name": "recursive",
			        "required": true,
			        "schema": "MyNestedRecursiveProps",
			        "tags": [],
			        "type": "MyNestedRecursiveProps",
			      },
			    },
			    "type": "MyNestedRecursiveProps",
			  },
			  "tags": [],
			  "type": "MyNestedRecursiveProps",
			}
		`);
	});

	test('reference-type-props-destructured', async () => {
		const componentPath = path.resolve(
			__dirname,
			'../../../test-workspace/component-meta/reference-type-props/component-destructure.vue',
		);
		const meta = await checker.getComponentMeta(componentPath);

		expect(meta.type).toEqual(TypeMeta.Class);

		const text = meta.props.find(prop => prop.name === 'text');
		expect(text?.default).toEqual("'foobar'");

		expect(text!.declarations.length).toBe(1);
		const [{ file, start, end }] = text!.declarations as [Declaration];
		expect(path.relative(workspace, file)).toBe(path.join('reference-type-props', 'component-destructure.vue'));
		expect(fs.readFileSync(componentPath, 'utf8').slice(start, end)).toBe('text: string;');
	});

	test('reference-type-props-non-ascii-default', async () => {
		const componentPath = path.resolve(
			__dirname,
			'../../../test-workspace/component-meta/reference-type-props/component-non-ascii.vue',
		);
		const meta = await getMeta(componentPath);

		expect(meta.type).toEqual(TypeMeta.Class);

		const label = meta.props.find(prop => prop.name === 'label');
		expect(label?.default).toEqual("'こんにちは'");
	});

	test('reference-type-props-js', async () => {
		const componentPath = path.resolve(
			__dirname,
			'../../../test-workspace/component-meta/reference-type-props/component-js.vue',
		);
		const meta = await getMeta(componentPath);

		expect(meta.type).toEqual(TypeMeta.Class);

		const foo = meta.props.find(prop => prop.name === 'foo');
		expect(foo).toMatchInlineSnapshot(`
			{
			  "declarations": [
			    "reference-type-props/component-js.vue: foo: {
					type: String,
					required: true
				}",
			  ],
			  "default": undefined,
			  "description": "",
			  "global": false,
			  "name": "foo",
			  "required": true,
			  "schema": "string",
			  "tags": [],
			  "type": "string",
			}
		`);

		const bar = meta.props.find(prop => prop.name === 'bar');
		expect(bar).toMatchInlineSnapshot(`
			{
			  "declarations": [
			    "reference-type-props/component-js.vue: bar: {
					type: String,
					default: 'BAR',
				}",
			  ],
			  "default": "'BAR'",
			  "description": "",
			  "global": false,
			  "name": "bar",
			  "required": false,
			  "schema": {
			    "kind": "enum",
			    "schema": [
			      "undefined",
			      "string",
			    ],
			    "type": "string | undefined",
			  },
			  "tags": [],
			  "type": "string | undefined",
			}
		`);

		const baz = meta.props.find(prop => prop.name === 'baz');
		expect(baz).toMatchInlineSnapshot(`
			{
			  "declarations": [
			    "reference-type-props/component-js.vue: baz: {
					type: String
				}",
			  ],
			  "default": undefined,
			  "description": "",
			  "global": false,
			  "name": "baz",
			  "required": false,
			  "schema": {
			    "kind": "enum",
			    "schema": [
			      "undefined",
			      "string",
			    ],
			    "type": "string | undefined",
			  },
			  "tags": [],
			  "type": "string | undefined",
			}
		`);

		const xfoo = meta.props.find(prop => prop.name === 'xfoo');
		expect(xfoo).toMatchInlineSnapshot(`
			{
			  "declarations": [
			    "reference-type-props/component-js.vue: xfoo: StringRequired",
			  ],
			  "default": undefined,
			  "description": "",
			  "global": false,
			  "name": "xfoo",
			  "required": true,
			  "schema": "string",
			  "tags": [],
			  "type": "string",
			}
		`);

		const xbar = meta.props.find(prop => prop.name === 'xbar');
		expect(xbar).toMatchInlineSnapshot(`
			{
			  "declarations": [
			    "reference-type-props/component-js.vue: xbar: StringEmpty",
			  ],
			  "default": undefined,
			  "description": "",
			  "global": false,
			  "name": "xbar",
			  "required": false,
			  "schema": {
			    "kind": "enum",
			    "schema": [
			      "undefined",
			      "string",
			    ],
			    "type": "string | undefined",
			  },
			  "tags": [],
			  "type": "string | undefined",
			}
		`);

		const xbaz = meta.props.find(prop => prop.name === 'xbaz');
		expect(xbaz).toMatchInlineSnapshot(`
			{
			  "declarations": [
			    "reference-type-props/component-js.vue: xbaz: StringUndefined",
			  ],
			  "default": undefined,
			  "description": "",
			  "global": false,
			  "name": "xbaz",
			  "required": false,
			  "schema": {
			    "kind": "enum",
			    "schema": [
			      "undefined",
			      "string",
			    ],
			    "type": "string | undefined",
			  },
			  "tags": [],
			  "type": "string | undefined",
			}
		`);
	});

	test('reference-type-props-js-setup', async () => {
		const componentPath = path.resolve(
			__dirname,
			'../../../test-workspace/component-meta/reference-type-props/component-js-setup.vue',
		);
		const meta = await getMeta(componentPath);

		expect(meta.type).toEqual(TypeMeta.Class);

		const foo = meta.props.find(prop => prop.name === 'foo');
		expect(foo).toMatchInlineSnapshot(`
			{
			  "declarations": [],
			  "default": undefined,
			  "description": "",
			  "global": false,
			  "name": "foo",
			  "required": true,
			  "schema": "string",
			  "tags": [],
			  "type": "string",
			}
		`);

		const bar = meta.props.find(prop => prop.name === 'bar');
		expect(bar).toMatchInlineSnapshot(`
			{
			  "declarations": [],
			  "default": "'BAR'",
			  "description": "",
			  "global": false,
			  "name": "bar",
			  "required": false,
			  "schema": {
			    "kind": "enum",
			    "schema": [
			      "undefined",
			      "string",
			    ],
			    "type": "string | undefined",
			  },
			  "tags": [],
			  "type": "string | undefined",
			}
		`);

		const baz = meta.props.find(prop => prop.name === 'baz');
		expect(baz).toMatchInlineSnapshot(`
			{
			  "declarations": [],
			  "default": undefined,
			  "description": "",
			  "global": false,
			  "name": "baz",
			  "required": false,
			  "schema": {
			    "kind": "enum",
			    "schema": [
			      "undefined",
			      "string",
			    ],
			    "type": "string | undefined",
			  },
			  "tags": [],
			  "type": "string | undefined",
			}
		`);

		const xfoo = meta.props.find(prop => prop.name === 'xfoo');
		expect(xfoo).toMatchInlineSnapshot(`
			{
			  "declarations": [],
			  "default": undefined,
			  "description": "",
			  "global": false,
			  "name": "xfoo",
			  "required": true,
			  "schema": "string",
			  "tags": [],
			  "type": "string",
			}
		`);

		const xbar = meta.props.find(prop => prop.name === 'xbar');
		expect(xbar).toMatchInlineSnapshot(`
			{
			  "declarations": [],
			  "default": undefined,
			  "description": "",
			  "global": false,
			  "name": "xbar",
			  "required": false,
			  "schema": {
			    "kind": "enum",
			    "schema": [
			      "undefined",
			      "string",
			    ],
			    "type": "string | undefined",
			  },
			  "tags": [],
			  "type": "string | undefined",
			}
		`);

		const xbaz = meta.props.find(prop => prop.name === 'xbaz');
		expect(xbaz).toMatchInlineSnapshot(`
			{
			  "declarations": [],
			  "default": undefined,
			  "description": "",
			  "global": false,
			  "name": "xbaz",
			  "required": false,
			  "schema": {
			    "kind": "enum",
			    "schema": [
			      "undefined",
			      "string",
			    ],
			    "type": "string | undefined",
			  },
			  "tags": [],
			  "type": "string | undefined",
			}
		`);

		const hello = meta.props.find(prop => prop.name === 'hello');
		expect(hello).toMatchInlineSnapshot(`
			{
			  "declarations": [],
			  "default": "'Hello'",
			  "description": "The hello property.",
			  "global": false,
			  "name": "hello",
			  "required": false,
			  "schema": {
			    "kind": "enum",
			    "schema": [
			      "undefined",
			      "string",
			    ],
			    "type": "string | undefined",
			  },
			  "tags": [
			    {
			      "name": "since",
			      "text": "v1.0.0",
			    },
			  ],
			  "type": "string | undefined",
			}
		`);

		const numberOrStringProp = meta.props.find(prop => prop.name === 'numberOrStringProp');
		expect(numberOrStringProp).toMatchInlineSnapshot(`
			{
			  "declarations": [],
			  "default": "42",
			  "description": "",
			  "global": false,
			  "name": "numberOrStringProp",
			  "required": false,
			  "schema": {
			    "kind": "enum",
			    "schema": [
			      "undefined",
			      "string",
			      "number",
			    ],
			    "type": "string | number | undefined",
			  },
			  "tags": [],
			  "type": "string | number | undefined",
			}
		`);

		const arrayProps = meta.props.find(prop => prop.name === 'arrayProps');
		expect(arrayProps).toMatchInlineSnapshot(`
			{
			  "declarations": [],
			  "default": "[42, 43, 44]",
			  "description": "",
			  "global": false,
			  "name": "arrayProps",
			  "required": false,
			  "schema": {
			    "kind": "enum",
			    "schema": [
			      "undefined",
			      {
			        "kind": "array",
			        "schema": [
			          "unknown",
			        ],
			        "type": "unknown[]",
			      },
			    ],
			    "type": "unknown[] | undefined",
			  },
			  "tags": [],
			  "type": "unknown[] | undefined",
			}
		`);
	});

	test('reference-type-events', async () => {
		const componentPath = path.resolve(
			__dirname,
			'../../../test-workspace/component-meta/reference-type-events/component.vue',
		);
		const meta = await getMeta(componentPath);

		expect(meta.type).toEqual(TypeMeta.Class);

		const onFoo = meta.events.find(event => event.name === 'foo');
		expect(onFoo).toMatchInlineSnapshot(`
			{
			  "declarations": [
			    "runtime-core.d.ts",
			  ],
			  "description": "",
			  "name": "foo",
			  "schema": [
			    {
			      "kind": "enum",
			      "schema": [
			        "undefined",
			        {
			          "kind": "object",
			          "schema": {
			            "foo": {
			              "declarations": [
			                "reference-type-events/my-events.ts: foo: string",
			              ],
			              "default": undefined,
			              "description": "",
			              "global": false,
			              "name": "foo",
			              "required": true,
			              "schema": "string",
			              "tags": [],
			              "type": "string",
			            },
			          },
			          "type": "{ foo: string; }",
			        },
			      ],
			      "type": "{ foo: string; } | undefined",
			    },
			  ],
			  "signature": "(event: "foo", data?: {
			    foo: string;
			} | undefined): void;",
			  "tags": [],
			  "type": "[data?: { foo: string; } | undefined]",
			}
		`);

		const onBar = meta.events.find(event => event.name === 'bar');
		expect(onBar).toMatchInlineSnapshot(`
			{
			  "declarations": [
			    "runtime-core.d.ts",
			  ],
			  "description": "",
			  "name": "bar",
			  "schema": [
			    {
			      "kind": "object",
			      "schema": {
			        "arg1": {
			          "declarations": [
			            "reference-type-events/my-events.ts: arg1: number;",
			          ],
			          "default": undefined,
			          "description": "",
			          "global": false,
			          "name": "arg1",
			          "required": true,
			          "schema": "number",
			          "tags": [],
			          "type": "number",
			        },
			        "arg2": {
			          "declarations": [
			            "reference-type-events/my-events.ts: arg2?: any",
			          ],
			          "default": undefined,
			          "description": "",
			          "global": false,
			          "name": "arg2",
			          "required": false,
			          "schema": "any",
			          "tags": [],
			          "type": "any",
			        },
			      },
			      "type": "{ arg1: number; arg2?: any; }",
			    },
			  ],
			  "signature": "(event: "bar", value: {
			    arg1: number;
			    arg2?: any;
			}): void;",
			  "tags": [],
			  "type": "[value: { arg1: number; arg2?: any; }]",
			}
		`);

		const onBaz = meta.events.find(event => event.name === 'baz');
		expect(onBaz).toMatchInlineSnapshot(`
			{
			  "declarations": [
			    "runtime-core.d.ts",
			  ],
			  "description": "",
			  "name": "baz",
			  "schema": [],
			  "signature": "(event: "baz"): void;",
			  "tags": [],
			  "type": "[]",
			}
		`);
	});

	test('reference-type-events w/ generic', async () => {
		const componentPath = path.resolve(__dirname, '../../../test-workspace/component-meta/generic/component.vue');
		const meta = await getMeta(componentPath);

		expect(meta.type).toEqual(TypeMeta.Function);

		const onBar = meta.events.find(event => event.name === 'bar');
		expect(onBar).toMatchInlineSnapshot(`
			{
			  "declarations": [
			    "generic/component.vue: (e: 'bar', data: number): void",
			  ],
			  "description": "",
			  "name": "bar",
			  "schema": [
			    "number",
			  ],
			  "signature": "(e: "bar", data: number): void;",
			  "tags": [],
			  "type": "[number]",
			}
		`);
	});

	test('reference-type-slots', async () => {
		const componentPath = path.resolve(
			__dirname,
			'../../../test-workspace/component-meta/reference-type-slots/component.vue',
		);
		const meta = await getMeta(componentPath);

		expect(meta.type).toEqual(TypeMeta.Class);

		const a = meta.slots.find(slot =>
			slot.name === 'default'
			&& slot.type === '{ num: number; }'
		);
		const b = meta.slots.find(slot =>
			slot.name === 'named-slot'
			&& slot.type === '{ str: string; }'
		);
		const c = meta.slots.find(slot =>
			slot.name === 'vbind'
			&& slot.type === '{ num: number; str: string; }'
		);
		const d = meta.slots.find(slot => slot.name === 'no-bind');

		expect(a).toBeDefined();
		expect(b).toBeDefined();
		expect(c).toBeDefined();
		expect(d).toBeDefined();
	});

	test('reference-type-slots w/ defineSlots', async () => {
		const componentPath = path.resolve(
			__dirname,
			'../../../test-workspace/component-meta/reference-type-slots/component-define-slots.vue',
		);
		const meta = await getMeta(componentPath);

		expect(meta.type).toEqual(TypeMeta.Class);

		const a = meta.slots.find(slot =>
			slot.name === 'default'
			&& slot.type === '{ num: number; }'
		);
		const b = meta.slots.find(slot =>
			slot.name === 'named-slot'
			&& slot.type === '{ str: string; }'
		);
		const c = meta.slots.find(slot =>
			slot.name === 'vbind'
			&& slot.type === '{ num: number; str: string; }'
		);
		const d = meta.slots.find(slot => slot.name === 'no-bind');

		expect(a).toBeDefined();
		expect(b).toBeDefined();
		expect(c).toBeDefined();
		expect(d).toBeDefined();

		expect(c).toStrictEqual(expect.objectContaining(
			{
				description: 'Slot with tags',
				tags: [
					{
						name: 'deprecated',
						text: 'do not use',
					},
				],
			},
		));
	});

	test('reference-type-slots w/ generic', async () => {
		const componentPath = path.resolve(__dirname, '../../../test-workspace/component-meta/generic/component.vue');
		const meta = await getMeta(componentPath);

		expect(meta.type).toEqual(TypeMeta.Function);

		expect(meta.slots.find(slot =>
			slot.name === 'default'
			&& slot.type === '{ foo: number; }'
		)).toBeDefined();
	});

	test('reference-type-exposed', async () => {
		const componentPath = path.resolve(
			__dirname,
			'../../../test-workspace/component-meta/reference-type-exposed/component.vue',
		);
		const meta = await getMeta(componentPath);

		expect(meta.type).toEqual(TypeMeta.Class);

		const counter = meta.exposed.find(exposed => exposed.name === 'counter');
		const oldCounter = meta.exposed.find(exposed => exposed.name === 'oldCounter');

		expect(counter).toMatchInlineSnapshot(`
			{
			  "declarations": [
			    "reference-type-exposed/my-exposed.ts: counter: Ref<string>;",
			  ],
			  "description": "a counter string",
			  "name": "counter",
			  "schema": "string",
			  "tags": [],
			  "type": "string",
			}
		`);
		expect(oldCounter).toStrictEqual(expect.objectContaining(
			{
				description: 'an oldCounter string',
				tags: [
					{
						name: 'deprecated',
						text: 'use counter instead',
					},
				],
			},
		));
		expect(meta.exposed.find(({ name }) => ['label', 'click', 'default'].includes(name))).toBeUndefined();
		expect(meta.props.find(({ name }) => name === 'label')).toBeDefined();
		expect(meta.events.find(({ name }) => name === 'click')).toBeDefined();
		expect(meta.slots.find(({ name }) => name === 'default')).toBeDefined();
	});

	test('options-api expose array', async () => {
		const componentPath = path.resolve(
			__dirname,
			'../../../test-workspace/component-meta/reference-type-exposed/component-options-api.vue',
		);
		const meta = await getMeta(componentPath);

		expect(meta.type).toEqual(TypeMeta.Class);
		expect(meta.exposed.map(({ name }) => name)).toStrictEqual(expect.arrayContaining(['increment', 'reset']));

		const reset = meta.exposed.find(exposed => exposed.name === 'reset');

		expect(reset).toMatchInlineSnapshot(`
			{
			  "declarations": [
			    "reference-type-exposed/component-options-api.vue: reset() {
			      (this as any).counter = 0;
			    }",
			  ],
			  "description": "Resets the counter to zero",
			  "name": "reset",
			  "schema": {
			    "kind": "event",
			    "schema": undefined,
			    "type": "(): void;",
			  },
			  "tags": [],
			  "type": "() => void",
			}
		`);
	});

	test('component with both props and events', async () => {
		const componentPath = path.resolve(__dirname, '../../../test-workspace/component-meta/#5546/main.vue');
		const meta = await getMeta(componentPath);

		expect(meta.type).toEqual(TypeMeta.Class);

		// Nothing special about this prop
		expect(meta.props.find(prop => prop.name === 'title')).toBeDefined();
		// Event
		expect(meta.props.find(prop => prop.name === 'onClose')).toBeUndefined();
		expect(meta.events.find(event => event.name === 'close')).toBeDefined();
		// Prop that starts with `on`
		expect(meta.props.find(prop => prop.name === 'onCompleted')).toBeDefined();
	});

	test('non-component', async () => {
		const componentPath = path.resolve(
			__dirname,
			'../../../test-workspace/component-meta/non-component/component.ts',
		);
		const meta = await getMeta(componentPath);

		expect(meta.type).toEqual(TypeMeta.Unknown);
	});

	test('ts-component', async () => {
		const componentPath = path.resolve(__dirname, '../../../test-workspace/component-meta/ts-component/component.ts');
		const meta = await getMeta(componentPath);

		expect(meta.type).toEqual(TypeMeta.Class);

		const a = meta.props.find(prop =>
			prop.name === 'foo'
			&& prop.required
			&& prop.type === 'string'
		);
		const b = meta.props.find(prop =>
			prop.name === 'bar'
			&& !prop.required
			&& prop.type === 'number | undefined'
		);

		expect(a).toBeDefined();
		expect(b).toBeDefined();
	});

	test('ts-component.tsx', async () => {
		const componentPath = path.resolve(
			__dirname,
			'../../../test-workspace/component-meta/ts-component/component-tsx.tsx',
		);
		const meta = await getMeta(componentPath);

		expect(meta.type).toEqual(TypeMeta.Class);

		const a = meta.props.find(prop =>
			prop.name === 'foo'
			&& prop.required
			&& prop.type === 'string'
		);
		const b = meta.props.find(prop =>
			prop.name === 'bar'
			&& !prop.required
			&& prop.type === 'number | undefined'
		);

		expect(a).toBeDefined();
		expect(b).toBeDefined();
	});

	test('ts-named-exports', async () => {
		const componentPath = path.resolve(
			__dirname,
			'../../../test-workspace/component-meta/ts-named-export/component.ts',
		);

		const exportNames = await checker.getExportNames(componentPath);
		expect(exportNames).toEqual(['Foo', 'Bar']);

		const Foo = toPortable(await checker.getComponentMeta(componentPath, 'Foo'));
		const Bar = toPortable(await checker.getComponentMeta(componentPath, 'Bar'));

		expect(Foo.type).toEqual(TypeMeta.Class);
		expect(Bar.type).toEqual(TypeMeta.Class);

		const a = Foo.props.find(prop =>
			prop.name === 'foo'
			&& prop.required
			&& prop.type === 'string'
		);
		const b = Bar.props.find(prop =>
			prop.name === 'bar'
			&& !prop.required
			&& prop.type === 'number | undefined'
		);

		expect(a).toBeDefined();
		expect(b).toBeDefined();
	});

	test('options-api', async () => {
		const componentPath = path.resolve(__dirname, '../../../test-workspace/component-meta/options-api/component.ts');
		const meta = await getMeta(componentPath);

		expect(meta.type).toEqual(TypeMeta.Class);

		const submitEvent = meta.events.find(evt => evt.name === 'submit');
		expect(submitEvent).toMatchInlineSnapshot(`
			{
			  "declarations": [
			    "runtime-core.d.ts",
			  ],
			  "description": "",
			  "name": "submit",
			  "schema": [
			    {
			      "kind": "object",
			      "schema": {
			        "email": {
			          "declarations": [
			            "options-api/component.ts: email: string;",
			          ],
			          "default": undefined,
			          "description": "email of user",
			          "global": false,
			          "name": "email",
			          "required": true,
			          "schema": "string",
			          "tags": [],
			          "type": "string",
			        },
			        "password": {
			          "declarations": [
			            "options-api/component.ts: password: string;",
			          ],
			          "default": undefined,
			          "description": "password of same user",
			          "global": false,
			          "name": "password",
			          "required": true,
			          "schema": "string",
			          "tags": [],
			          "type": "string",
			        },
			      },
			      "type": "SubmitPayload",
			    },
			  ],
			  "signature": "(event: "submit", args_0: SubmitPayload): void;",
			  "tags": [],
			  "type": "[SubmitPayload]",
			}
		`);

		const propNumberDefault = meta.props.find(prop => prop.name === 'numberDefault');
		expect(propNumberDefault).toMatchInlineSnapshot(`
			{
			  "declarations": [
			    "options-api/component.ts: numberDefault: {
						type: Number,
						default: 42,
					}",
			  ],
			  "default": "42",
			  "description": "Default number",
			  "global": false,
			  "name": "numberDefault",
			  "required": false,
			  "schema": {
			    "kind": "enum",
			    "schema": [
			      "undefined",
			      "number",
			    ],
			    "type": "number | undefined",
			  },
			  "tags": [],
			  "type": "number | undefined",
			}
		`);

		const propObjectDefault = meta.props.find(prop => prop.name === 'objectDefault');
		expect(propObjectDefault).toMatchInlineSnapshot(`
			{
			  "declarations": [
			    "options-api/component.ts: objectDefault: {
						type: Object,
						default: () => ({
							foo: 'bar',
						}),
					}",
			  ],
			  "default": "{
							foo: 'bar',
						}",
			  "description": "Default function Object",
			  "global": false,
			  "name": "objectDefault",
			  "required": false,
			  "schema": {
			    "kind": "enum",
			    "schema": [
			      "undefined",
			      "Record<string, any>",
			    ],
			    "type": "Record<string, any> | undefined",
			  },
			  "tags": [],
			  "type": "Record<string, any> | undefined",
			}
		`);

		const propArrayDefault = meta.props.find(prop => prop.name === 'arrayDefault');
		expect(propArrayDefault).toMatchInlineSnapshot(`
			{
			  "declarations": [
			    "options-api/component.ts: arrayDefault: {
						type: Array,
						default: () => [1, 2, 3],
					}",
			  ],
			  "default": "[1, 2, 3]",
			  "description": "Default function Array",
			  "global": false,
			  "name": "arrayDefault",
			  "required": false,
			  "schema": {
			    "kind": "enum",
			    "schema": [
			      "undefined",
			      {
			        "kind": "array",
			        "schema": [
			          "unknown",
			        ],
			        "type": "unknown[]",
			      },
			    ],
			    "type": "unknown[] | undefined",
			  },
			  "tags": [],
			  "type": "unknown[] | undefined",
			}
		`);
	});

	test('js-component (script setup)', async () => {
		const componentPath = path.resolve(
			__dirname,
			'../../../test-workspace/component-meta/js-component/component.vue',
		);
		const meta = await getMeta(componentPath);

		expect(meta.type).toEqual(TypeMeta.Class);
		expect(
			meta.props.filter(prop => !prop.global).map(prop => [prop.name, prop.type, prop.required]),
		).toEqual([
			['bar', 'number | undefined', false],
			['foo', 'string', true],
		]);
		expect(meta.slots.map(slot => [slot.name, slot.type])).toEqual([['header', '{ count: number; }']]);
	});

	test('js-component (options api)', async () => {
		const componentPath = path.resolve(
			__dirname,
			'../../../test-workspace/component-meta/js-component/component-options.vue',
		);
		const meta = await getMeta(componentPath);

		expect(meta.type).toEqual(TypeMeta.Class);
		expect(
			meta.props.filter(prop => !prop.global).map(prop => [prop.name, prop.type, prop.required]),
		).toEqual([
			['foo', 'string', true],
		]);
		expect(meta.events.map(event => event.name)).toEqual(['change']);
	});

	test('component-name-description (vue)', async () => {
		const componentPath = path.resolve(
			__dirname,
			'../../../test-workspace/component-meta/component-name-description/component.vue',
		);
		const meta = await getMeta(componentPath);

		expect(meta.name).toBe('MyComponent');
		expect(meta.description).toBe('My awesome component description');
		expect(meta.type).toEqual(TypeMeta.Class);
	});

	test('component-name-description (ts)', async () => {
		const componentPath = path.resolve(
			__dirname,
			'../../../test-workspace/component-meta/component-name-description/component-ts.ts',
		);
		const meta = await getMeta(componentPath);

		expect(meta.name).toBe('TsComponent');
		expect(meta.description).toBe('TypeScript component with description');
		expect(meta.type).toEqual(TypeMeta.Class);
	});

	test('component-no-name (vue)', async () => {
		const componentPath = path.resolve(
			__dirname,
			'../../../test-workspace/component-meta/component-name-description/component-no-name.vue',
		);
		const meta = await getMeta(componentPath);

		expect(meta.name).toBeUndefined();
		expect(meta.description).toBeUndefined();
		expect(meta.type).toEqual(TypeMeta.Class);
	});
});

describe('project scope', async () => {
	const scopedChecker = await createChecker(path.join(workspace, 'tsconfig.scope.json'), checkerOptions);
	afterAll(() => scopedChecker.close());

	test('component outside the project', async () => {
		const outsidePath = path.join(workspace, 'reference-type-props/component.vue');
		await expect(scopedChecker.getExportNames(outsidePath)).rejects.toThrow();
		await expect(scopedChecker.getComponentMeta(outsidePath)).rejects.toThrow();
	});

	test('missing export', async () => {
		const componentPath = path.join(workspace, 'empty-component/component.vue');
		await expect(scopedChecker.getComponentMeta(componentPath, 'missing')).rejects.toThrow();
	});

	test('reads the files from disk on every query', async () => {
		const consumerPath = path.join(workspace, 'empty-component/disk-consumer.vue');
		const depPath = path.join(workspace, 'empty-component/disk-dep.ts');
		const propNames = async () => (await scopedChecker.getComponentMeta(consumerPath)).props.map(prop => prop.name);
		try {
			fs.writeFileSync(depPath, `export interface DepProps { foo: string }\n`);
			fs.writeFileSync(
				consumerPath,
				`<script setup lang="ts">\nimport type { DepProps } from './disk-dep';\ndefineProps<DepProps>();\n</script>\n`,
			);
			expect(await propNames()).toContain('foo');

			fs.writeFileSync(depPath, `export interface DepProps { bar: string }\n`);
			const names = await propNames();
			expect(names).toContain('bar');
			expect(names).not.toContain('foo');

			fs.rmSync(consumerPath);
			await expect(scopedChecker.getComponentMeta(consumerPath)).rejects.toThrow();
		}
		finally {
			fs.rmSync(consumerPath, { force: true });
			fs.rmSync(depPath, { force: true });
		}
	});
});

describe('checker', () => {
	const tsconfig = path.join(workspace, 'tsconfig.json');
	const propsPath = path.join(workspace, 'reference-type-props/component.vue');
	const eventsPath = path.join(workspace, 'reference-type-events/component.vue');

	test('await using', async () => {
		await using checker = await createChecker(tsconfig, checkerOptions);
		expect(await checker.getExportNames(propsPath)).toEqual(['default']);
	});

	test('results are plain data', async () => {
		await using checker = await createChecker(tsconfig, checkerOptions);
		const meta = await checker.getComponentMeta(propsPath);
		expect(meta.props.some(prop => prop.declarations.length)).toBe(true);
		expect(JSON.parse(JSON.stringify(meta))).toEqual(meta);
	});

	test('getComponentMetas', async () => {
		await using checker = await createChecker(tsconfig, checkerOptions);
		expect(await checker.getComponentMetas([propsPath, eventsPath])).toEqual([
			await checker.getComponentMeta(propsPath),
			await checker.getComponentMeta(eventsPath),
		]);
	});
});

describe('project', async () => {
	const tsconfig = path.join(workspace, 'tsconfig.json').replace(/\\/g, '/');
	const eventsPath = path.join(workspace, 'reference-type-events/component.vue');
	const { API } = await import('typescript-7/async');

	test('getComponentMeta / getExportNames', async () => {
		await using checker = await createChecker(tsconfig, checkerOptions);
		const api = new API({ cwd: workspace, runExternalCode: true });
		const snapshot = await api.createSnapshot({ openProjects: [tsconfig] });
		try {
			const project = snapshot.getConfiguredProject(tsconfig)!;
			expect(await getExportNames(project, eventsPath)).toEqual(['default']);
			expect(await getComponentMeta(project, eventsPath, 'default', { ...checkerOptions, printer: api.printer }))
				.toEqual(await checker.getComponentMeta(eventsPath));

			const withoutPrinter = await getComponentMeta(project, eventsPath, 'default', checkerOptions);
			expect(withoutPrinter.events.length).toBeGreaterThan(0);
			expect(withoutPrinter.events.every(event => event.signature === '')).toBe(true);
		}
		finally {
			await snapshot.dispose();
			await api.close();
		}
	});
});
