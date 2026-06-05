import { HTTP_AS } from './http';
import { WEBSOCKET_AS } from './websocket';

/** Echo "Networking" category -- async HTTP, WebSocket. */
export const NETWORKING_SOURCES: ReadonlyArray<readonly [string, string]> = [
  ['networking/http.as',      HTTP_AS],
  ['networking/websocket.as', WEBSOCKET_AS],
];
