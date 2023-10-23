<script setup lang="ts">
import { exactType } from '../../shared';

const foo = defineProps<{ foo: string }>().foo;

exactType(foo, '' as string);
</script>