<script setup lang="ts">
// @ts-nocheck wait for 3.3 added defineModel
import { exactType } from '../../shared';

const a = defineModel<string>(); // modelValue
const c = defineModel<number>('c', { required: true });
const d = defineModel<number>('d', { required: false });
const e = defineModel<string>('e');
const f = defineModel<string>('f', { required: true });
const g = defineModel<string>('g', { required: false });
</script>
