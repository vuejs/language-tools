<script setup lang="ts" generic="T extends import('./model').ModelAlias">
import type Item from './Item.vue';
import type { Renders } from 'vue-component-type-helpers';
import type { ModelAlias } from './model';
defineProps<{ item: T; base?: ModelAlias }>();
defineSlots<{ default: () => Renders<typeof Item<T>>[] }>();
</script>
