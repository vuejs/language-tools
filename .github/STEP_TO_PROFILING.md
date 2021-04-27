# Setp To Profiling

## Setup Chrome Inspect

1. Open chrome://inspect/#devices in Chrome.
2. Open `Configure...` of Discover network targets.
3. Add Volar server debug address:
   - `localhost:6009` for API server.
   - `localhost:6010` for Document server.
   - `localhost:6011` for HTML server.

## Run Volar on Debug Mode

1. Clone `https://github.com/johnsoncodehk/volar` and run `$ yarn` to install dependencies.
2. Open Volar project on VSCode.
3. `Ctrl+Shift+D` to switch to VSCode Debug, and run debug as `Launch Client`.
4. A new VSCode window will be open, open your project in the new VSCode window.

## Start Profiling

Reference: https://github.com/vuejs/vetur/blob/master/.github/PERF_ISSUE.md#profiling
