import * as path from 'path';
import { describe, expect, it } from 'vitest';
import * as metaChecker from '..';

describe(`vue-component-meta`, () => {

	const tsconfigPath = path.resolve(__dirname, '../../vue-test-workspace/vue-component-meta/tsconfig.json');
	const checker = metaChecker.createComponentMetaChecker(tsconfigPath);

	it('reference-type-props', () => {

		const componentPath = path.resolve(__dirname, '../../vue-test-workspace/vue-component-meta/reference-type-props/component.vue');
		const meta = checker.getComponentMeta(componentPath);

		const a = meta.props.find(prop =>
			prop.name === 'foo'
			&& !prop.isOptional
			&& prop.type === 'string'
			&& prop.documentationComment === 'string foo'
		);
		const b = meta.props.find(prop =>
			prop.name === 'bar'
			&& prop.isOptional
			&& prop.type === 'number | undefined'
			&& prop.documentationComment === 'optional number bar'
		);

		expect(a).toBeDefined();
		expect(b).toBeDefined();
	});

	it('reference-type-events', () => {

		const componentPath = path.resolve(__dirname, '../../vue-test-workspace/vue-component-meta/reference-type-events/component.vue');
		const meta = checker.getComponentMeta(componentPath);

		const a = meta.events.find(event =>
			event.name === 'foo'
			&& event.parametersType === '[data: { foo: string; }]'
			&& event.parameters.length === 1
			&& event.parameters[0].type === '{ foo: string; }'
		);
		const b = meta.events.find(event =>
			event.name === 'bar'
			&& event.parametersType === '[arg1: number, arg2?: any]'
			&& event.parameters.length === 2
			&& event.parameters[0].type === 'number'
			&& event.parameters[1].type === 'any'
		);
		const c = meta.events.find(event =>
			event.name === 'baz'
			&& event.parametersType === '[]'
			&& event.parameters.length === 0
		);

		expect(a).toBeDefined();
		expect(b).toBeDefined();
		expect(c).toBeDefined();
	});

	it('template-slots', () => {

		const componentPath = path.resolve(__dirname, '../../vue-test-workspace/vue-component-meta/template-slots/component.vue');
		const meta = checker.getComponentMeta(componentPath);

		const a = meta.slots.find(event =>
			event.name === 'default'
			&& event.propsType === '{ num: number; }'
		);
		const b = meta.slots.find(event =>
			event.name === 'named-slot'
			&& event.propsType === '{ str: string; }'
		);
		const c = meta.slots.find(event =>
			event.name === 'vbind'
			&& event.propsType === '{ num: number; str: string; }'
		);

		expect(a).toBeDefined();
		expect(b).toBeDefined();
		expect(c).toBeDefined();
	});
});
