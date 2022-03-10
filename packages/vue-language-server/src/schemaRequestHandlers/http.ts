import { xhr, XHRResponse, configure as configureHttpRequests, getErrorStatusDescription } from 'request-light';

export default function handler(uri: string) {
    const headers = { 'Accept-Encoding': 'gzip, deflate' };
    return xhr({ url: uri, followRedirects: 5, headers }).then(response => {
        return response.responseText;
    }, (error: XHRResponse) => {
        return Promise.reject(error.responseText || getErrorStatusDescription(error.status) || error.toString());
    });
}
