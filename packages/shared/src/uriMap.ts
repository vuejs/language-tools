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
export class UriSet extends Set<string> {
    delete(uri: string) {
        return super.delete(uri.toLowerCase());
    }
    has(uri: string) {
        return super.has(uri.toLowerCase());
    }
    add(uri: string) {
        return super.add(uri.toLowerCase());
    }
}
export class FsPathMap<T> extends UriMap<T> {};
export class FsPathSet extends UriSet {};
