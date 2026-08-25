import * as fs from 'node:fs';
import * as path from 'node:path';
import { expect, test } from 'vitest';
import { runTsc } from './utils';

test(`vue-tsc`, () => {
	const dirPath = path.resolve(__dirname, '..', '..', '..', 'test-workspace', 'tsc');
	const tests = fs.readdirSync(dirPath)
		.filter(dir => fs.existsSync(path.resolve(dirPath, dir, 'tsconfig.json')));

	fs.writeFileSync(
		path.resolve(__dirname, '../../../test-workspace/tsc/tsconfig.json'),
		JSON.stringify(
			{
				include: [],
				references: tests.map(testDir => ({ path: `./${testDir}/tsconfig.json` })),
			},
			undefined,
			'\t',
		) + '\n',
	);

	expect(
		runTsc('tsc').sort(),
	).toMatchInlineSnapshot(`
		[
		  "test-workspace/tsc/_failed_#3632/both.vue(3,1): error TS1109: Expression expected.",
		  "test-workspace/tsc/_failed_#3632/both.vue(7,1): error TS1109: Expression expected.",
		  "test-workspace/tsc/_failed_#3632/script.vue(3,1): error TS1109: Expression expected.",
		  "test-workspace/tsc/_failed_#3632/scriptSetup.vue(3,1): error TS1109: Expression expected.",
		  "test-workspace/tsc/_failed_#4569/main.vue(1,33): error TS4025: Exported variable '__VLS_export' has or is using private name 'Props'.",
		  "test-workspace/tsc/_failed_#5071/withScript.vue(1,19): error TS1005: ';' expected.",
		  "test-workspace/tsc/_failed_#5071/withoutScript.vue(2,26): error TS1005: ';' expected.",
		  "test-workspace/tsc/_failed_#5823/main.vue(6,13): error TS1109: Expression expected.",
		  "test-workspace/tsc/_failed_directives/main.vue(14,6): error TS2339: Property 'notExist' does not exist on type 'ComponentPublicInstance<{}, {}, {}, {}, {}, string[], {}, {}, false, any, {}, {}, "", {}, any, {}, false>'.",
		  "test-workspace/tsc/_failed_directives/main.vue(17,2): error TS2578: Unused '@ts-expect-error' directive.",
		  "test-workspace/tsc/_failed_directives/main.vue(20,2): error TS2578: Unused '@ts-expect-error' directive.",
		  "test-workspace/tsc/_failed_directives/main.vue(9,6): error TS2339: Property 'notExist' does not exist on type 'ComponentPublicInstance<{}, {}, {}, {}, {}, string[], {}, {}, false, any, {}, {}, "", {}, any, {}, false>'.",
		  "test-workspace/tsc/_failed_fragment_props/main.vue(12,46): error TS2339: Property 'bar' does not exist on type '{ id: number; }'.",
		  "test-workspace/tsc/_failed_fragment_props/main.vue(12,54): error TS2339: Property 'baz' does not exist on type '{ id: number; }'.",
		  "test-workspace/tsc/_failed_fragment_props/main.vue(6,31): error TS2322: Type '{ id: number; }' is not assignable to type 'PropertyKey | undefined'.",
		  "test-workspace/tsc/_failed_fragment_props/main.vue(9,32): error TS2353: Object literal may only specify known properties, and 'foo' does not exist in type 'HTMLAttributes & ReservedProps'.",
		  "test-workspace/tsc/unwrapBindingAccess/main.vue(183,43): error TS2345: Argument of type 'boolean' is not assignable to parameter of type 'never'.",
		  "test-workspace/tsc/unwrapBindingAccess/main.vue(184,51): error TS2345: Argument of type 'boolean' is not assignable to parameter of type 'never'.",
		  "test-workspace/tsc/unwrapBindingAccess/main.vue(187,46): error TS2345: Argument of type 'boolean' is not assignable to parameter of type 'never'.",
		  "test-workspace/tsc/unwrapBindingAccess/main.vue(188,48): error TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'never'.",
		  "test-workspace/tsc/unwrapBindingAccess/main.vue(191,59): error TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'never'.",
		  "test-workspace/tsc/unwrapBindingAccess/main.vue(192,65): error TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'never'.",
		  "test-workspace/tsc/unwrapBindingAccess/main.vue(195,2): error TS2578: Unused '@ts-expect-error' directive.",
		  "test-workspace/tsc/unwrapBindingAccess/main.vue(197,2): error TS2578: Unused '@ts-expect-error' directive.",
		  "test-workspace/tsc/unwrapBindingAccess/main.vue(201,36): error TS1166: A computed property name in a class property declaration must have a simple literal type or a 'unique symbol' type.",
		  "test-workspace/tsc/unwrapBindingAccess/main.vue(204,26): error TS2464: A computed property name must be of type 'string', 'number', 'symbol', or 'any'.",
		  "test-workspace/tsc/unwrapBindingAccess/main.vue(204,27): error TS2538: Type 'Ref<"m", "m">' cannot be used as an index type.",
		  "test-workspace/tsc/unwrapBindingAccess/main.vue(211,20): error TS2345: Argument of type 'number & { value: number; }' is not assignable to parameter of type 'never'.",
		  "test-workspace/tsc/unwrapBindingAccess/main.vue(214,43): error TS2345: Argument of type '1 | 2 | 3' is not assignable to parameter of type 'never'.",
		  "test-workspace/tsc/unwrapBindingAccess/main.vue(215,53): error TS2345: Argument of type '1 | 2' is not assignable to parameter of type 'never'.",
		  "test-workspace/tsc/unwrapBindingAccess/main.vue(215,85): error TS2345: Argument of type '"a" | "b"' is not assignable to parameter of type 'never'.",
		  "test-workspace/tsc/unwrapBindingAccess/main.vue(218,55): error TS2345: Argument of type 'string | Ref<number, number>' is not assignable to parameter of type 'never'.",
		  "test-workspace/tsc/unwrapBindingAccess/main.vue(219,65): error TS2345: Argument of type 'number | Ref<number, number>' is not assignable to parameter of type 'never'.",
		  "test-workspace/tsc/unwrapBindingAccess/main.vue(222,13): error TS18048: 'fnUndef' is possibly 'undefined'.",
		  "test-workspace/tsc/unwrapBindingAccess/main.vue(222,35): error TS18048: 'fnUndef' is possibly 'undefined'.",
		  "test-workspace/tsc/unwrapBindingAccess/main.vue(223,27): error TS18048: 'fnUndef' is possibly 'undefined'.",
		  "test-workspace/tsc/unwrapBindingAccess/main.vue(224,13): error TS18048: 'strUndef' is possibly 'undefined'.",
		  "test-workspace/tsc/unwrapBindingAccess/main.vue(224,36): error TS18048: 'strUndef' is possibly 'undefined'.",
		  "test-workspace/tsc/unwrapBindingAccess/main.vue(225,27): error TS18048: 'strUndef' is possibly 'undefined'.",
		  "test-workspace/tsc/unwrapBindingAccess/main.vue(226,13): error TS18047: 'fnNull' is possibly 'null'.",
		  "test-workspace/tsc/unwrapBindingAccess/main.vue(226,34): error TS18047: 'fnNull' is possibly 'null'.",
		  "test-workspace/tsc/unwrapBindingAccess/main.vue(227,27): error TS18047: 'fnNull' is possibly 'null'.",
		  "test-workspace/tsc/unwrapBindingAccess/main.vue(228,44): error TS2345: Argument of type '1' is not assignable to parameter of type 'never'.",
		  "test-workspace/tsc/useTemplateRef-dynamic-arg/main.vue(3,7): error TS2464: A computed property name must be of type 'string', 'number', 'symbol', or 'any'.",
		  "test-workspace/tsc/useTemplateRef-nullable/main.vue(3,5): error TS18047: 'foo.value' is possibly 'null'.",
		  "test-workspace/tsc/useTemplateRef-nullable/main.vue(3,9): error TS2339: Property 'bar' does not exist on type 'HTMLInputElement'.",
		  "test-workspace/tsc/withDotValue/main.vue(10,19): error TS2740: Type 'TemplateStringsArray' is missing the following properties from type 'Event': bubbles, cancelBubble, cancelable, composed, and 18 more.",
		  "test-workspace/tsc/withDotValue/main.vue(2,25): error TS2345: Argument of type 'number' is not assignable to parameter of type 'Event'.",
		  "test-workspace/tsc/withDotValue/main.vue(3,17): error TS2345: Argument of type 'number' is not assignable to parameter of type 'Event'.",
		  "test-workspace/tsc/withDotValue/main.vue(4,28): error TS2345: Argument of type 'number' is not assignable to parameter of type 'Event'.",
		  "test-workspace/tsc/withDotValue/main.vue(5,28): error TS2345: Argument of type 'number' is not assignable to parameter of type 'Event'.",
		  "test-workspace/tsc/withDotValue/main.vue(6,20): error TS2345: Argument of type 'number' is not assignable to parameter of type 'Event'.",
		  "test-workspace/tsc/withDotValue/main.vue(7,24): error TS2740: Type 'TemplateStringsArray' is missing the following properties from type 'Event': bubbles, cancelBubble, cancelable, composed, and 18 more.",
		  "test-workspace/tsc/withDotValue/main.vue(8,16): error TS2740: Type 'TemplateStringsArray' is missing the following properties from type 'Event': bubbles, cancelBubble, cancelable, composed, and 18 more.",
		  "test-workspace/tsc/withDotValue/main.vue(9,27): error TS2740: Type 'TemplateStringsArray' is missing the following properties from type 'Event': bubbles, cancelBubble, cancelable, composed, and 18 more.",
		]
	`);
});
