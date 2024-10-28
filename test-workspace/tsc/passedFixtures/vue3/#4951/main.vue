<script setup lang="ts">
import { useCssModule } from 'vue';
import { exactType } from '../../shared';

const module = useCssModule('button');
exactType(module, {} as Record<string, string> & {
    foo: string;
});
</script>

<style module="button">
.foo { }
</style>