/**
 * Echo Async HTTP API -- async GET/POST with callbacks plus fire-and-forget.
 * Source: https://echo-23.gitbook.io/angel/networking/async-http
 *
 * User-Agent: prism/1.0
 * Timeout: 10s
 * Redirects are followed automatically.
 */
export const HTTP_AS = `
/** Result handed to a response_callback. */
class http_response {
    /** HTTP status code (200, 404, etc). */
    int status_code;
    /** Response body (raw). */
    string body;
    /** Transport-level error message; empty on success. */
    string error;
}

/** Callback signature for the async http::get / http::post overloads. */
funcdef void response_callback(http_response@ response);

namespace http {

/**
 * Async GET -- fires the request on a background thread and invokes \`cb\`
 * on completion. Only callable from main().
 */
void get(string url, response_callback@ cb);

/**
 * Async POST -- fires the request on a background thread and invokes \`cb\`
 * on completion. Only callable from main().
 */
void post(string url, string body, string content_type, response_callback@ cb);

/**
 * Fire-and-forget GET -- no callback, no response. Callable from any
 * context (including shutdown). Intended for webhooks and one-way pings.
 */
void get(string url);

/**
 * Fire-and-forget POST -- no callback, no response. Callable from any
 * context (including shutdown). Intended for webhooks and one-way pings.
 */
void post(string url, string body, string content_type);

}
`;
