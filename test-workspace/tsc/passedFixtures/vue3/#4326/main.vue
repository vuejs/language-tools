<script setup lang="ts">
import { exactType } from '../../shared';

const { bottom } = defineSlots<{
	bottom: (props: { num: number; }) => any[],
}>();

exactType(bottom, {} as (props: {
	num: number;
}) => any[]);
</script>
