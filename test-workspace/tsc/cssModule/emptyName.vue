<script lang="ts" setup>
import { useCssModule } from 'vue';
import { exactType } from '../shared';

const style = useCssModule();
exactType(style, {} as Record<string, string> & {
    a: string;
});
</script>

<style module="">
.a {}
</style>
