/** Barrel for the ORCA API layer. */

export { API_BASE, API_V1 } from './config.js';
export { ApiError, AuthError, NetworkError, checkHealth } from './http.js';

export * as authApi from './auth.js';
export * as profileApi from './profile.js';
export * as alertsApi from './alerts.js';
export * as pfzApi from './pfz.js';
export * as chatApi from './chat.js';

export { PFZ_STATUS, PFZ_EMPTY_REASON } from './pfz.js';
export { FEED_STATUS } from './alerts.js';
export { createTurnAccumulator, createSseParser, streamChat, sendChat } from './chat.js';