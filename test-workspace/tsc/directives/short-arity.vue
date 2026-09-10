<script setup lang="ts">
import type { DirectiveBinding } from 'vue';
import { exactType } from '../shared';

let Comp!: (_: { foo?: string; }) => void;

let vShort1!: (el: typeof Comp) => void;
let vShort2!: (el: typeof Comp, binding: DirectiveBinding<(_: number) => void>) => void;
let vShort3!: (el: typeof Comp, binding: DirectiveBinding<(_: string) => void, 'attr' | 'prop', 'foo'>, vnode: unknown) => void;
</script>

<template>
	<Comp v-short1 />
	<Comp v-short2="v => exactType(v, {} as number)" />
	<Comp v-short3:foo.attr.prop="v => exactType(v, {} as string)" />
</template>
