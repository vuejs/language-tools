import * as path from 'node:path';
import { describe, expect, test } from 'vitest';
import { type ComponentMetaChecker, createChecker, createCheckerByJson, type MetaCheckerOptions, TypeMeta } from '..';

const worker = (checker: ComponentMetaChecker, withTsconfig: boolean) => describe(`vue-component-meta ${withTsconfig ? 'w/ tsconfig' : 'w/o tsconfig'}`, () => {

	test('empty-component', () => {
		const componentPath = path.resolve(__dirname, '../../../test-workspace/component-meta/empty-component/component.vue');
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
		const componentPath = path.resolve(__dirname, '../../../test-workspace/component-meta/reference-type-model/component.vue');
		const meta = checker.getComponentMeta(componentPath);

		expect(meta.type).toEqual(TypeMeta.Class);

		const modelValue = meta.props.find(prop => prop.name === 'modelValue');
		const onUpdateModelValue = meta.events.find(event => event.name === 'update:modelValue');

		expect(modelValue).toMatchSnapshot('modelValue');
		expect(onUpdateModelValue).toBeDefined();

		const foo = meta.props.find(prop => prop.name === 'foo');
		const onUpdateFoo = meta.events.find(event => event.name === 'update:foo');

		expect(foo).toMatchSnapshot('foo');
		expect(onUpdateFoo).toBeDefined();

		const bar = meta.props.find(prop => prop.name === 'bar');
		const barModifiers = meta.props.find(prop => prop.name === 'barModifiers');
		const onUpdateBaz = meta.events.find(event => event.name === 'update:bar');

		expect(bar).toMatchSnapshot('bar');
		expect(barModifiers).toMatchSnapshot('barModifiers');
		expect(onUpdateBaz).toBeDefined();
	});

	test('reference-type-props', () => {
		const componentPath = path.resolve(__dirname, '../../../test-workspace/component-meta/reference-type-props/component.vue');
		const meta = checker.getComponentMeta(componentPath);

		expect(meta.type).toEqual(TypeMeta.Class);

		const foo = meta.props.find(prop => prop.name === 'foo');
		expect(foo).toMatchSnapshot('foo');

		const bar = meta.props.find(prop => prop.name === 'bar');
		expect(bar).toMatchSnapshot('bar');

		const baz = meta.props.find(prop => prop.name === 'baz');
		expect(baz).toMatchSnapshot('baz');

		const union = meta.props.find(prop => prop.name === 'union');
		expect(union).toMatchSnapshot('union');

		const unionOptional = meta.props.find(prop => prop.name === 'unionOptional');
		expect(unionOptional).toMatchSnapshot('unionOptional');

		const nested = meta.props.find(prop => prop.name === 'nested');
		expect(nested).toMatchSnapshot('nested');

		const nestedIntersection = meta.props.find(prop => prop.name === 'nestedIntersection');
		expect(nestedIntersection).toMatchSnapshot('nestedIntersection');

		const nestedOptional = meta.props.find(prop => prop.name === 'nestedOptional');
		expect(nestedOptional).toMatchSnapshot('nestedOptional');

		const array = meta.props.find(prop => prop.name === 'array');
		expect(array).toMatchSnapshot('array');

		const arrayOptional = meta.props.find(prop => prop.name === 'arrayOptional');
		expect(arrayOptional).toMatchSnapshot('arrayOptional');

		const enumValue = meta.props.find(prop => prop.name === 'enumValue');
		expect(enumValue).toMatchSnapshot('enumValue');

		const namespaceType = meta.props.find(prop => prop.name === 'namespaceType');
		expect(namespaceType).toMatchSnapshot('namespaceType');

		const literalFromContext = meta.props.find(prop => prop.name === 'literalFromContext');
		expect(literalFromContext).toMatchSnapshot('literalFromContext');

		const inlined = meta.props.find(prop => prop.name === 'inlined');
		expect(inlined).toMatchSnapshot('inlined');

		const recursive = meta.props.find(prop => prop.name === 'recursive');
		expect(recursive).toMatchSnapshot('recursive');
	});

	test('reference-type-props-destructured', () => {
		const componentPath = path.resolve(__dirname, '../../../test-workspace/component-meta/reference-type-props/component-destructure.vue');
		const meta = checker.getComponentMeta(componentPath);

		expect(meta.type).toEqual(TypeMeta.Class);

		const text = meta.props.find(prop => prop.name === 'text');

		expect(text?.default).toEqual('"foobar"');
	});

	test('reference-type-props-js', () => {
		const componentPath = path.resolve(__dirname, '../../../test-workspace/component-meta/reference-type-props/component-js.vue');
		const meta = checker.getComponentMeta(componentPath);

		expect(meta.type).toEqual(TypeMeta.Class);

		const foo = meta.props.find(prop => prop.name === 'foo');
		expect(foo).toMatchSnapshot('foo');

		const bar = meta.props.find(prop => prop.name === 'bar');
		expect(bar).toMatchSnapshot('bar');

		const baz = meta.props.find(prop => prop.name === 'baz');
		expect(baz).toMatchSnapshot('baz');

		const xfoo = meta.props.find(prop => prop.name === 'xfoo');
		expect(xfoo).toMatchSnapshot('xfoo');

		const xbar = meta.props.find(prop => prop.name === 'xbar');
		expect(xbar).toMatchSnapshot('xbar');

		const xbaz = meta.props.find(prop => prop.name === 'xbaz');
		expect(xbaz).toMatchSnapshot('xbaz');
	});

	test('reference-type-props-js-setup', () => {
		const componentPath = path.resolve(__dirname, '../../../test-workspace/component-meta/reference-type-props/component-js-setup.vue');
		const meta = checker.getComponentMeta(componentPath);

		expect(meta.type).toEqual(TypeMeta.Class);

		const foo = meta.props.find(prop => prop.name === 'foo');
		expect(foo).toMatchSnapshot('foo');

		const bar = meta.props.find(prop => prop.name === 'bar');
		expect(bar).toMatchSnapshot('bar');

		const baz = meta.props.find(prop => prop.name === 'baz');
		expect(baz).toMatchSnapshot('baz');

		const xfoo = meta.props.find(prop => prop.name === 'xfoo');
		expect(xfoo).toMatchSnapshot('xfoo');

		const xbar = meta.props.find(prop => prop.name === 'xbar');
		expect(xbar).toMatchSnapshot('xbar');

		const xbaz = meta.props.find(prop => prop.name === 'xbaz');
		expect(xbaz).toMatchSnapshot('xbaz');

		const hello = meta.props.find(prop => prop.name === 'hello');
		expect(hello).toMatchSnapshot('hello');

		const numberOrStringProp = meta.props.find(prop => prop.name === 'numberOrStringProp');
		expect(numberOrStringProp).toMatchSnapshot('numberOrStringProp');

		const arrayProps = meta.props.find(prop => prop.name === 'arrayProps');
		expect(arrayProps).toMatchSnapshot('arrayProps');
	});

	test('reference-type-events', () => {
		const componentPath = path.resolve(__dirname, '../../../test-workspace/component-meta/reference-type-events/component.vue');
		const meta = checker.getComponentMeta(componentPath);

		expect(meta.type).toEqual(TypeMeta.Class);

		const onFoo = meta.events.find(event => event.name === 'foo');
		expect(onFoo).toMatchSnapshot('onFoo');

		const onBar = meta.events.find(event => event.name === 'bar');
		expect(onBar).toMatchSnapshot('onBar');

		const onBaz = meta.events.find(event => event.name === 'baz');
		expect(onBaz).toMatchSnapshot('onBaz');
	});

	test('reference-type-events w/ generic', () => {
		const componentPath = path.resolve(__dirname, '../../../test-workspace/component-meta/generic/component.vue');
		const meta = checker.getComponentMeta(componentPath);

		expect(meta.type).toEqual(TypeMeta.Function);

		const onBar = meta.events.find(event => event.name === 'bar');
		expect(onBar).toMatchSnapshot('onBar');
	});

	test('reference-type-slots', () => {
		const componentPath = path.resolve(__dirname, '../../../test-workspace/component-meta/reference-type-slots/component.vue');
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
		const d = meta.slots.find(slot =>
			slot.name === 'no-bind'
		);

		expect(a).toBeDefined();
		expect(b).toBeDefined();
		expect(c).toBeDefined();
		expect(d).toBeDefined();
	});

	test('reference-type-slots w/ defineSlots', () => {
		const componentPath = path.resolve(__dirname, '../../../test-workspace/component-meta/reference-type-slots/component-define-slots.vue');
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
		const d = meta.slots.find(slot =>
			slot.name === 'no-bind'
		);

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
		const componentPath = path.resolve(__dirname, '../../../test-workspace/component-meta/reference-type-exposed/component.vue');
		const meta = checker.getComponentMeta(componentPath);

		expect(meta.type).toEqual(TypeMeta.Class);

		const counter = meta.exposed.find(exposed => exposed.name === 'counter');
		expect(counter).toMatchSnapshot('counter');
	});

	test('non-component', () => {
		const componentPath = path.resolve(__dirname, '../../../test-workspace/component-meta/non-component/component.ts');
		const meta = checker.getComponentMeta(componentPath);

		expect(meta.type).toEqual(TypeMeta.Unknown);
	});

	test('ts-component', () => {
		const componentPath = path.resolve(__dirname, '../../../test-workspace/component-meta/ts-component/component.ts');
		const meta = checker.getComponentMeta(componentPath);

		expect(meta.type).toEqual(TypeMeta.Class);

		const a = meta.props.find(prop =>
			prop.name === 'foo'
			&& prop.required === true
			&& prop.type === 'string'
		);
		const b = meta.props.find(prop =>
			prop.name === 'bar'
			&& prop.required === false
			&& prop.type === 'number | undefined'
		);

		expect(a).toBeDefined();
		expect(b).toBeDefined();
	});

	test('ts-component.tsx', () => {
		const componentPath = path.resolve(__dirname, '../../../test-workspace/component-meta/ts-component/component.tsx');
		const meta = checker.getComponentMeta(componentPath);

		expect(meta.type).toEqual(TypeMeta.Class);

		const a = meta.props.find(prop =>
			prop.name === 'foo'
			&& prop.required === true
			&& prop.type === 'string'
		);
		const b = meta.props.find(prop =>
			prop.name === 'bar'
			&& prop.required === false
			&& prop.type === 'number | undefined'
		);

		expect(a).toBeDefined();
		expect(b).toBeDefined();
	});

	test('ts-named-exports', () => {
		const componentPath = path.resolve(__dirname, '../../../test-workspace/component-meta/ts-named-export/component.ts');

		const exportNames = checker.getExportNames(componentPath);
		expect(exportNames).toEqual(['Foo', 'Bar']);

		const Foo = checker.getComponentMeta(componentPath, 'Foo');
		const Bar = checker.getComponentMeta(componentPath, 'Bar');

		expect(Foo.type).toEqual(TypeMeta.Class);
		expect(Bar.type).toEqual(TypeMeta.Class);

		const a = Foo.props.find(prop =>
			prop.name === 'foo'
			&& prop.required === true
			&& prop.type === 'string'
		);
		const b = Bar.props.find(prop =>
			prop.name === 'bar'
			&& prop.required === false
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
		expect(submitEvent).toMatchSnapshot('submitEvent');

		const propNumberDefault = meta.props.find(prop => prop.name === 'numberDefault');
		expect(propNumberDefault).toMatchSnapshot('propNumberDefault');

		const propObjectDefault = meta.props.find(prop => prop.name === 'objectDefault');
		expect(propObjectDefault).toMatchSnapshot('propObjectDefault');

		const propArrayDefault = meta.props.find(prop => prop.name === 'arrayDefault');
		expect(propArrayDefault).toMatchSnapshot('propArrayDefault');
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
	checkerOptions
);
const noTsConfigChecker = createCheckerByJson(
	path.resolve(__dirname, '../../../test-workspace/component-meta'),
	{
		"extends": "../tsconfig.base.json",
		"include": [
			"**/*",
		],
	},
	checkerOptions
);

worker(tsconfigChecker, true);
worker(noTsConfigChecker, false);
