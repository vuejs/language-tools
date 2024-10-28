<script lang="ts" setup>
import { useCssModule } from 'vue';
import { exactType } from '../../shared';

const style = useCssModule();
exactType(style, {} as Record<string, string> & {
    style: string;
});

const foo = useCssModule('foo');
exactType(foo, {} as Record<string, string> & {
    foo: string;
});

const bar = useCssModule('bar');
exactType(bar, {} as Record<string, string> & {
    bar: string;
});
</script>

<style module>
.style { }
</style>

<style module="foo">
.foo { }
</style>

<style module="bar">
.bar { }
</style>