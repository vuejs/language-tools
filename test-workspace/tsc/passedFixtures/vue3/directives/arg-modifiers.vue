<script setup lang="ts">
import type { FunctionDirective, ObjectDirective } from 'vue';
import { exactType } from '../../shared';

let Comp!: (_: { foo?: string; }) => void;

let vArg!: FunctionDirective<typeof Comp, (_: boolean) => void, string, 'foo'>;
let vModifiers!: ObjectDirective<typeof Comp, (_: boolean) => void, 'attr' | 'prop'>;
</script>

<template>
	<Comp v-arg:foo="v => exactType(v, {} as boolean)"/>
	<!-- @vue-expect-error -->
	<Comp v-arg:bar="v => exactType(v, {} as boolean)"/>

	<Comp v-modifiers.attr.prop="v => exactType(v, {} as boolean)" />
	<!-- @vue-expect-error -->
	<Comp v-modifiers.unknown="v => exactType(v, {} as boolean)" />
</template>
