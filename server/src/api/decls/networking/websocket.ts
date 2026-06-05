/**
 * Echo WebSocket API -- single-connection async WebSocket with callbacks.
 * Source: https://echo-23.gitbook.io/angel/networking/websocket
 *
 * All callbacks fire on the connection thread -- mutex-protect any shared
 * state they touch.
 */
export const WEBSOCKET_AS = `
/** Invoked when the WebSocket finishes its handshake. */
funcdef void connect_callback();

/** Invoked for each text message received from the server. */
funcdef void message_callback(string msg);

/** Invoked when the connection is closed (either side). */
funcdef void disconnect_callback();

/** Invoked when the connection produces an error. */
funcdef void error_callback(string msg);

namespace ws {

/** Open a WebSocket connection to \`url\` and wire up the lifecycle callbacks. */
void connect(
    string url,
    connect_callback@ on_open,
    message_callback@ on_message,
    disconnect_callback@ on_disconnect,
    error_callback@ on_error
);

/** Re-open the previously connected URL with the same callbacks. */
void reconnect();

/** Close the current connection. */
void disconnect();

/** True if the connection is currently open. */
bool is_connected();

/** Send a text frame to the server. */
void send(string msg);

}
`;
