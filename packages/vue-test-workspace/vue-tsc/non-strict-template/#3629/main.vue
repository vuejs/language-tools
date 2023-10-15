<script setup lang="ts">
import { exactType } from 'vue-tsc/shared';

const foo = defineProps<{ foo: string }>().foo;

exactType(foo, '' as string);
</script>