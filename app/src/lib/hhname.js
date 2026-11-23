// A household still wearing the name it was created with gets asked for a real one (once).
export const DEFAULT_NAMES = /^(our|my|new)\s+household$/i;
export const needsName = (app, hh) => !app.settings.hhNamed && !!hh && (!hh.name || DEFAULT_NAMES.test(hh.name.trim()));
