// Somehow we cannot require('vscode') inside jiti.
// So in DEV mode, we have to store the vscode object to `globalThis.__VOLAR_DEV_VSCODE__`,
// and export the object there for other modules to use, without breaking any existing code
module.exports = globalThis.__VOLAR_DEV_VSCODE__
