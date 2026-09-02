/** The path canonicaliser Atlas uses (atlas/join.mjs): `:id` and `{name}` both become `{id}`. */
export const canon = (p: string) => p.replace(/:(\w+)/g, "{id}").replace(/\{[a-zA-Z]+\}/g, "{id}");
export const routeKey = (method: string, path: string) => `${method.toUpperCase()} ${canon(path)}`;
