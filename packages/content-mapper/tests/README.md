# Tests

## Full-corpus diagnostic snapshot

Run the content mapper over every project under `test-workspace/tsc` and
compare against the committed snapshot:

```sh
pnpm test corpus
```

The test generates temporary project sidecars, runs the installed native `tsc`
with `--runExternalCode` over the 222-project graph, then snapshots the
normalized diagnostics. Use `pnpm test corpus -- -u` to update the snapshot
after an intentional change.
