import { defineDiagnosticsTest } from '../utils/diagnostics';

defineDiagnosticsTest({
	title: 'duplicate event: kebab-case and camelCase — only second is flagged',
	content: `
<template>
	<Comp @create-post="() => {}" @createPost="() => {}" />
</template>
<script setup lang="ts">
declare const Comp: new () => { $emit(event: 'create-post'): void };
</script>
`,
	expectCodes: ['duplicate-event-listener'],
	expectCount: 1,
});

defineDiagnosticsTest({
	title: 'duplicate event: identical names — only second is flagged',
	content: `
<template>
	<Comp @create-post="() => {}" @create-post="() => {}" />
</template>
<script setup lang="ts">
declare const Comp: new () => { $emit(event: 'create-post'): void };
</script>
`,
	expectCodes: ['duplicate-event-listener'],
	expectCount: 1,
});

defineDiagnosticsTest({
	title: 'duplicate @update: kebab-case and camelCase — only second is flagged',
	content: `
<template>
	<Comp @update:post-title="() => {}" @update:postTitle="() => {}" />
</template>
<script setup lang="ts">
declare const Comp: new () => { $emit(event: 'update:postTitle', val: string): void };
</script>
`,
	expectCodes: ['duplicate-event-listener'],
	expectCount: 1,
});

defineDiagnosticsTest({
	title: 'three duplicate events — two are flagged',
	content: `
<template>
	<Comp @create-post="() => {}" @createPost="() => {}" @createPost="() => {}" />
</template>
<script setup lang="ts">
declare const Comp: new () => { $emit(event: 'create-post'): void };
</script>
`,
	expectCodes: ['duplicate-event-listener'],
	expectCount: 2,
});

defineDiagnosticsTest({
	title: 'duplicate @vue: vnode lifecycle hooks — only second is flagged',
	content: `
<template>
	<Comp @vue:before-mount="() => {}" @vue:beforeMount="() => {}" />
</template>
<script setup lang="ts">
declare const Comp: new () => { $props: Record<string, unknown> };
</script>
`,
	expectCodes: ['duplicate-event-listener'],
	expectCount: 1,
});

defineDiagnosticsTest({
	title: 'no false positive: different events',
	content: `
<template>
	<Comp @create-post="() => {}" @update:title="() => {}" />
</template>
<script setup lang="ts">
declare const Comp: new () => {
	$emit(event: 'create-post'): void;
	$emit(event: 'update:title', val: string): void;
};
</script>
`,
	expectCodes: ['duplicate-event-listener'],
	expectCount: 0,
});

defineDiagnosticsTest({
	title: 'no false positive: prop and event with same camelCase root',
	content: `
<template>
	<Comp :title="'a'" @update:title="() => {}" />
</template>
<script setup lang="ts">
declare const Comp: new () => {
	$props: { title: string };
	$emit(event: 'update:title', val: string): void;
};
</script>
`,
	expectCodes: ['duplicate-event-listener'],
	expectCount: 0,
});

defineDiagnosticsTest({
	title: 'no false positive: dynamic event arg',
	content: `
<template>
	<Comp @[event]="() => {}" @[event]="() => {}" />
</template>
<script setup lang="ts">
declare const Comp: new () => { $emit(event: string): void };
const event = 'click';
</script>
`,
	expectCodes: ['duplicate-event-listener'],
	expectCount: 0,
});

defineDiagnosticsTest({
	title: 'no false positive: native element is not flagged',
	content: `
<template>
	<div @click="() => {}" @click="() => {}" />
</template>
<script setup lang="ts">
</script>
`,
	expectCodes: ['duplicate-event-listener'],
	expectCount: 0,
});
