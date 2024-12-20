<script setup lang="ts">
import { exactType } from '../../shared';

const fooBar = defineModel<string, 'foo' | 'bar'>('fooBar', {
    default: '...'
});

exactType(fooBar[1], {} as Record<'foo' | 'bar', true | undefined>);
</script>
