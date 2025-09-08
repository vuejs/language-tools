import * as path from 'node:path';
import { describe, expect, test } from 'vitest';
import { type ComponentMetaChecker, createChecker, createCheckerByJson, type MetaCheckerOptions, TypeMeta } from '..';

const worker = (checker: ComponentMetaChecker, withTsconfig: boolean) =>
	describe(`vue-component-meta ${withTsconfig ? 'w/ tsconfig' : 'w/o tsconfig'}`, () => {
		test('empty-component', () => {
			const componentPath = path.resolve(
				__dirname,
				'../../../test-workspace/component-meta/empty-component/component.vue',
			);
			const meta = checker.getComponentMeta(componentPath);

			expect(meta.props.map(prop => prop.name)).toEqual([
				'key',
				'ref',
				'ref_for',
				'ref_key',
				'class',
				'style',
			]);
			expect(meta.props.filter(prop => !prop.global)).toEqual([]);
		});

		test('reference-type-model', () => {
			const componentPath = path.resolve(
				__dirname,
				'../../../test-workspace/component-meta/reference-type-model/component.vue',
			);
			const meta = checker.getComponentMeta(componentPath);

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
			  "rawType": undefined,
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
			  "rawType": undefined,
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
			  "description": "optional string bar with lazy and trim modifiers",
			  "global": false,
			  "name": "bar",
			  "rawType": undefined,
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
			  "description": "",
			  "global": false,
			  "name": "barModifiers",
			  "rawType": undefined,
			  "required": false,
			  "schema": {
			    "kind": "enum",
			    "schema": [
			      "undefined",
			      "Partial<Record<"trim" | "lazy", true>>",
			    ],
			    "type": "Partial<Record<"trim" | "lazy", true>> | undefined",
			  },
			  "tags": [],
			  "type": "Partial<Record<"trim" | "lazy", true>> | undefined",
			}
		`);
			expect(onUpdateBaz).toBeDefined();
		});

		test('reference-type-props', () => {
			const componentPath = path.resolve(
				__dirname,
				'../../../test-workspace/component-meta/reference-type-props/component.vue',
			);
			const meta = checker.getComponentMeta(componentPath);

			expect(meta.type).toEqual(TypeMeta.Class);

			const foo = meta.props.find(prop => prop.name === 'foo');
			expect(foo).toMatchInlineSnapshot(`
			{
			  "declarations": [],
			  "description": "string foo",
			  "global": false,
			  "name": "foo",
			  "rawType": undefined,
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
			  "declarations": [],
			  "default": "1",
			  "description": "optional number bar",
			  "global": false,
			  "name": "bar",
			  "rawType": undefined,
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
			  "declarations": [],
			  "default": "["foo", "bar"]",
			  "description": "string array baz",
			  "global": false,
			  "name": "baz",
			  "rawType": undefined,
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
			  "declarations": [],
			  "description": "required union type",
			  "global": false,
			  "name": "union",
			  "rawType": undefined,
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
			  "declarations": [],
			  "description": "optional union type",
			  "global": false,
			  "name": "unionOptional",
			  "rawType": undefined,
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
			  "declarations": [],
			  "description": "required nested object",
			  "global": false,
			  "name": "nested",
			  "rawType": undefined,
			  "required": true,
			  "schema": {
			    "kind": "object",
			    "schema": {
			      "nestedProp": {
			        "declarations": [],
			        "description": "nested prop documentation",
			        "global": false,
			        "name": "nestedProp",
			        "rawType": undefined,
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
			  "declarations": [],
			  "description": "required nested object with intersection",
			  "global": false,
			  "name": "nestedIntersection",
			  "rawType": undefined,
			  "required": true,
			  "schema": {
			    "kind": "object",
			    "schema": {
			      "additionalProp": {
			        "declarations": [],
			        "description": "required additional property",
			        "global": false,
			        "name": "additionalProp",
			        "rawType": undefined,
			        "required": true,
			        "schema": "string",
			        "tags": [],
			        "type": "string",
			      },
			      "nestedProp": {
			        "declarations": [],
			        "description": "nested prop documentation",
			        "global": false,
			        "name": "nestedProp",
			        "rawType": undefined,
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
			  "declarations": [],
			  "description": "optional nested object",
			  "global": false,
			  "name": "nestedOptional",
			  "rawType": undefined,
			  "required": false,
			  "schema": {
			    "kind": "enum",
			    "schema": [
			      "undefined",
			      {
			        "kind": "object",
			        "schema": {
			          "nestedProp": {
			            "declarations": [],
			            "description": "nested prop documentation",
			            "global": false,
			            "name": "nestedProp",
			            "rawType": undefined,
			            "required": true,
			            "schema": "string",
			            "tags": [],
			            "type": "string",
			          },
			        },
			        "type": "MyNestedProps",
			      },
			      "MyIgnoredNestedProps",
			    ],
			    "type": "MyNestedProps | MyIgnoredNestedProps | undefined",
			  },
			  "tags": [],
			  "type": "MyNestedProps | MyIgnoredNestedProps | undefined",
			}
		`);

			const array = meta.props.find(prop => prop.name === 'array');
			expect(array).toMatchInlineSnapshot(`
			{
			  "declarations": [],
			  "description": "required array object",
			  "global": false,
			  "name": "array",
			  "rawType": undefined,
			  "required": true,
			  "schema": {
			    "kind": "array",
			    "schema": [
			      {
			        "kind": "object",
			        "schema": {
			          "nestedProp": {
			            "declarations": [],
			            "description": "nested prop documentation",
			            "global": false,
			            "name": "nestedProp",
			            "rawType": undefined,
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
			  "declarations": [],
			  "description": "optional array object",
			  "global": false,
			  "name": "arrayOptional",
			  "rawType": undefined,
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
			                "declarations": [],
			                "description": "nested prop documentation",
			                "global": false,
			                "name": "nestedProp",
			                "rawType": undefined,
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
			  "declarations": [],
			  "description": "enum value",
			  "global": false,
			  "name": "enumValue",
			  "rawType": undefined,
			  "required": true,
			  "schema": {
			    "kind": "enum",
			    "schema": [
			      "MyEnum.Small",
			      "MyEnum.Medium",
			      "MyEnum.Large",
			    ],
			    "type": "MyEnum",
			  },
			  "tags": [],
			  "type": "MyEnum",
			}
		`);

			const namespaceType = meta.props.find(prop => prop.name === 'namespaceType');
			expect(namespaceType).toMatchInlineSnapshot(`
			{
			  "declarations": [],
			  "description": "namespace type",
			  "global": false,
			  "name": "namespaceType",
			  "rawType": undefined,
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
			  "declarations": [],
			  "description": "literal type alias that require context",
			  "global": false,
			  "name": "literalFromContext",
			  "rawType": undefined,
			  "required": true,
			  "schema": {
			    "kind": "enum",
			    "schema": [
			      ""Uncategorized"",
			      ""Content"",
			      ""Interaction"",
			      ""Display"",
			      ""Forms"",
			      ""Addons"",
			    ],
			    "type": ""Uncategorized" | "Content" | "Interaction" | "Display" | "Forms" | "Addons"",
			  },
			  "tags": [],
			  "type": ""Uncategorized" | "Content" | "Interaction" | "Display" | "Forms" | "Addons"",
			}
		`);

			const inlined = meta.props.find(prop => prop.name === 'inlined');
			expect(inlined).toMatchInlineSnapshot(`
			{
			  "declarations": [],
			  "description": "",
			  "global": false,
			  "name": "inlined",
			  "rawType": undefined,
			  "required": true,
			  "schema": {
			    "kind": "object",
			    "schema": {
			      "foo": {
			        "declarations": [],
			        "description": "",
			        "global": false,
			        "name": "foo",
			        "rawType": undefined,
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
			  "declarations": [],
			  "description": "",
			  "global": false,
			  "name": "recursive",
			  "rawType": undefined,
			  "required": true,
			  "schema": {
			    "kind": "object",
			    "schema": {
			      "recursive": {
			        "declarations": [],
			        "description": "",
			        "global": false,
			        "name": "recursive",
			        "rawType": undefined,
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

		test('reference-type-props-destructured', () => {
			const componentPath = path.resolve(
				__dirname,
				'../../../test-workspace/component-meta/reference-type-props/component-destructure.vue',
			);
			const meta = checker.getComponentMeta(componentPath);

			expect(meta.type).toEqual(TypeMeta.Class);

			const text = meta.props.find(prop => prop.name === 'text');

			expect(text?.default).toEqual('"foobar"');
		});

		test('reference-type-props-js', () => {
			const componentPath = path.resolve(
				__dirname,
				'../../../test-workspace/component-meta/reference-type-props/component-js.vue',
			);
			const meta = checker.getComponentMeta(componentPath);

			expect(meta.type).toEqual(TypeMeta.Class);

			const foo = meta.props.find(prop => prop.name === 'foo');
			expect(foo).toMatchInlineSnapshot(`
			{
			  "declarations": [],
			  "default": undefined,
			  "description": "",
			  "global": false,
			  "name": "foo",
			  "rawType": undefined,
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
			  "default": ""BAR"",
			  "description": "",
			  "global": false,
			  "name": "bar",
			  "rawType": undefined,
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
			  "rawType": undefined,
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
			  "description": "",
			  "global": false,
			  "name": "xfoo",
			  "rawType": undefined,
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
			  "description": "",
			  "global": false,
			  "name": "xbar",
			  "rawType": undefined,
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
			  "description": "",
			  "global": false,
			  "name": "xbaz",
			  "rawType": undefined,
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

		test('reference-type-props-js-setup', () => {
			const componentPath = path.resolve(
				__dirname,
				'../../../test-workspace/component-meta/reference-type-props/component-js-setup.vue',
			);
			const meta = checker.getComponentMeta(componentPath);

			expect(meta.type).toEqual(TypeMeta.Class);

			const foo = meta.props.find(prop => prop.name === 'foo');
			expect(foo).toMatchInlineSnapshot(`
			{
			  "declarations": [],
			  "default": undefined,
			  "description": "",
			  "global": false,
			  "name": "foo",
			  "rawType": undefined,
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
			  "default": ""BAR"",
			  "description": "",
			  "global": false,
			  "name": "bar",
			  "rawType": undefined,
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
			  "rawType": undefined,
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
			  "description": "",
			  "global": false,
			  "name": "xfoo",
			  "rawType": undefined,
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
			  "description": "",
			  "global": false,
			  "name": "xbar",
			  "rawType": undefined,
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
			  "description": "",
			  "global": false,
			  "name": "xbaz",
			  "rawType": undefined,
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
			  "default": ""Hello"",
			  "description": "The hello property.",
			  "global": false,
			  "name": "hello",
			  "rawType": undefined,
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
			  "rawType": undefined,
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
			  "rawType": undefined,
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

		test('reference-type-events', () => {
			const componentPath = path.resolve(
				__dirname,
				'../../../test-workspace/component-meta/reference-type-events/component.vue',
			);
			const meta = checker.getComponentMeta(componentPath);

			expect(meta.type).toEqual(TypeMeta.Class);

			const onFoo = meta.events.find(event => event.name === 'foo');
			expect(onFoo).toMatchInlineSnapshot(`
			{
			  "declarations": [],
			  "description": "",
			  "name": "foo",
			  "rawType": undefined,
			  "schema": [
			    {
			      "kind": "enum",
			      "schema": [
			        "undefined",
			        {
			          "kind": "object",
			          "schema": {
			            "foo": {
			              "declarations": [],
			              "description": "",
			              "global": false,
			              "name": "foo",
			              "rawType": undefined,
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
			  "signature": "(event: "foo", data?: { foo: string; } | undefined): void",
			  "tags": [],
			  "type": "[{ foo: string; } | undefined]",
			}
		`);

			const onBar = meta.events.find(event => event.name === 'bar');
			expect(onBar).toMatchInlineSnapshot(`
			{
			  "declarations": [],
			  "description": "",
			  "name": "bar",
			  "rawType": undefined,
			  "schema": [
			    {
			      "kind": "object",
			      "schema": {
			        "arg1": {
			          "declarations": [],
			          "description": "",
			          "global": false,
			          "name": "arg1",
			          "rawType": undefined,
			          "required": true,
			          "schema": "number",
			          "tags": [],
			          "type": "number",
			        },
			        "arg2": {
			          "declarations": [],
			          "description": "",
			          "global": false,
			          "name": "arg2",
			          "rawType": undefined,
			          "required": false,
			          "schema": "any",
			          "tags": [],
			          "type": "any",
			        },
			      },
			      "type": "{ arg1: number; arg2?: any; }",
			    },
			  ],
			  "signature": "(event: "bar", value: { arg1: number; arg2?: any; }): void",
			  "tags": [],
			  "type": "[{ arg1: number; arg2?: any; }]",
			}
		`);

			const onBaz = meta.events.find(event => event.name === 'baz');
			expect(onBaz).toMatchInlineSnapshot(`
			{
			  "declarations": [],
			  "description": "",
			  "name": "baz",
			  "rawType": undefined,
			  "schema": [],
			  "signature": "(e: "baz"): void",
			  "tags": [],
			  "type": "[]",
			}
		`);
		});

		test('reference-type-events w/ generic', () => {
			const componentPath = path.resolve(__dirname, '../../../test-workspace/component-meta/generic/component.vue');
			const meta = checker.getComponentMeta(componentPath);

			expect(meta.type).toEqual(TypeMeta.Function);

			const onBar = meta.events.find(event => event.name === 'bar');
			expect(onBar).toMatchInlineSnapshot(`
			{
			  "declarations": [],
			  "description": "",
			  "name": "bar",
			  "rawType": undefined,
			  "schema": [
			    "number",
			  ],
			  "signature": "(e: "bar", data: number): void",
			  "tags": [],
			  "type": "[number]",
			}
		`);
		});

		test('reference-type-slots', () => {
			const componentPath = path.resolve(
				__dirname,
				'../../../test-workspace/component-meta/reference-type-slots/component.vue',
			);
			const meta = checker.getComponentMeta(componentPath);

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

		test('reference-type-slots w/ defineSlots', () => {
			const componentPath = path.resolve(
				__dirname,
				'../../../test-workspace/component-meta/reference-type-slots/component-define-slots.vue',
			);
			const meta = checker.getComponentMeta(componentPath);

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

		test('reference-type-slots w/ generic', () => {
			const componentPath = path.resolve(__dirname, '../../../test-workspace/component-meta/generic/component.vue');
			const meta = checker.getComponentMeta(componentPath);

			expect(meta.type).toEqual(TypeMeta.Function);

			expect(meta.slots.find(slot =>
				slot.name === 'default'
				&& slot.type === '{ foo: number; }'
			)).toBeDefined();
		});

		test('reference-type-exposed', () => {
			const componentPath = path.resolve(
				__dirname,
				'../../../test-workspace/component-meta/reference-type-exposed/component.vue',
			);
			const meta = checker.getComponentMeta(componentPath);

			expect(meta.type).toEqual(TypeMeta.Class);

			const counter = meta.exposed.find(exposed => exposed.name === 'counter');
			expect(counter).toMatchInlineSnapshot(`
			{
			  "declarations": [],
			  "description": "a counter string",
			  "name": "counter",
			  "rawType": undefined,
			  "schema": "string",
			  "type": "string",
			}
		`);
		});

		test('component with both props and events', () => {
			const componentPath = path.resolve(__dirname, '../../../test-workspace/component-meta/#5546/main.vue');
			const meta = checker.getComponentMeta(componentPath);

			expect(meta.type).toEqual(TypeMeta.Class);

			// Nothing special about this prop
			expect(meta.props.find(prop => prop.name === 'title')).toBeDefined();
			// Event
			expect(meta.props.find(prop => prop.name === 'onClose')).toBeUndefined();
			expect(meta.events.find(event => event.name === 'close')).toBeDefined();
			// Prop that starts with `on`
			expect(meta.props.find(prop => prop.name === 'onCompleted')).toBeDefined();
		});

		test('non-component', () => {
			const componentPath = path.resolve(
				__dirname,
				'../../../test-workspace/component-meta/non-component/component.ts',
			);
			const meta = checker.getComponentMeta(componentPath);

			expect(meta.type).toEqual(TypeMeta.Unknown);
		});

		test('ts-component', () => {
			const componentPath = path.resolve(__dirname, '../../../test-workspace/component-meta/ts-component/component.ts');
			const meta = checker.getComponentMeta(componentPath);

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

		test('ts-component.tsx', () => {
			const componentPath = path.resolve(
				__dirname,
				'../../../test-workspace/component-meta/ts-component/component.tsx',
			);
			const meta = checker.getComponentMeta(componentPath);

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

		test('ts-named-exports', () => {
			const componentPath = path.resolve(
				__dirname,
				'../../../test-workspace/component-meta/ts-named-export/component.ts',
			);

			const exportNames = checker.getExportNames(componentPath);
			expect(exportNames).toEqual(['Foo', 'Bar']);

			const Foo = checker.getComponentMeta(componentPath, 'Foo');
			const Bar = checker.getComponentMeta(componentPath, 'Bar');

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

		test('options-api', () => {
			const componentPath = path.resolve(__dirname, '../../../test-workspace/component-meta/options-api/component.ts');
			const meta = checker.getComponentMeta(componentPath);

			expect(meta.type).toEqual(TypeMeta.Class);

			const submitEvent = meta.events.find(evt => evt.name === 'submit');
			expect(submitEvent).toMatchInlineSnapshot(`
			{
			  "declarations": [],
			  "description": "",
			  "name": "submit",
			  "rawType": undefined,
			  "schema": [
			    {
			      "kind": "object",
			      "schema": {
			        "email": {
			          "declarations": [],
			          "description": "email of user",
			          "global": false,
			          "name": "email",
			          "rawType": undefined,
			          "required": true,
			          "schema": "string",
			          "tags": [],
			          "type": "string",
			        },
			        "password": {
			          "declarations": [],
			          "description": "password of same user",
			          "global": false,
			          "name": "password",
			          "rawType": undefined,
			          "required": true,
			          "schema": "string",
			          "tags": [],
			          "type": "string",
			        },
			      },
			      "type": "SubmitPayload",
			    },
			  ],
			  "signature": "(event: "submit", args_0: SubmitPayload): void",
			  "tags": [],
			  "type": "[SubmitPayload]",
			}
		`);

			const propNumberDefault = meta.props.find(prop => prop.name === 'numberDefault');
			expect(propNumberDefault).toMatchInlineSnapshot(`
			{
			  "declarations": [],
			  "default": "42",
			  "description": "Default number",
			  "global": false,
			  "name": "numberDefault",
			  "rawType": undefined,
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
				  "declarations": [],
				  "default": "{
				    foo: "bar",
				}",
				  "description": "Default function Object",
				  "global": false,
				  "name": "objectDefault",
				  "rawType": undefined,
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
			  "declarations": [],
			  "default": "[1, 2, 3]",
			  "description": "Default function Array",
			  "global": false,
			  "name": "arrayDefault",
			  "rawType": undefined,
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
	});

const checkerOptions: MetaCheckerOptions = {
	forceUseTs: true,
	noDeclarations: true,
	schema: { ignore: ['MyIgnoredNestedProps'] },
	printer: { newLine: 1 },
};
const tsconfigChecker = createChecker(
	path.resolve(__dirname, '../../../test-workspace/component-meta/tsconfig.json'),
	checkerOptions,
);
const noTsConfigChecker = createCheckerByJson(
	path.resolve(__dirname, '../../../test-workspace/component-meta'),
	{
		'extends': '../tsconfig.base.json',
		'include': [
			'**/*',
		],
	},
	checkerOptions,
);

worker(tsconfigChecker, true);
worker(noTsConfigChecker, false);
