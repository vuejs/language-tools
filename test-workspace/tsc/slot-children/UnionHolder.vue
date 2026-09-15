<script setup lang="ts">
import type { Renders } from 'vue-component-type-helpers';
import type Item from './Item.vue';
import type Other from './Other.vue';
import type { UnionSlots } from './union-types';
defineSlots<UnionSlots & {
	generic?: () => Renders<typeof Item<string | number>>[];
	constrained?: () => Renders<typeof Item<string> | typeof Other, { value: 'yes'; other: 'yes' }>;
}>();
</script>
