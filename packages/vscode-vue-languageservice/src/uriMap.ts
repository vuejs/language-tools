export class UriMap<T> extends Map<string, T> {
    delete(uri: string) {
        return super.delete(uri.toLowerCase());
    }
    get(uri: string) {
        return super.get(uri.toLowerCase());
    }
    has(uri: string) {
        return super.has(uri.toLowerCase());
    }
    set(uri: string, item: T) {
        return super.set(uri.toLowerCase(), item);
    }
}
