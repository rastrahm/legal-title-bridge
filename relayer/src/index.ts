/**
 * Legal Title Bridge relayer process entry — watchers, sign, submit, reconcile, status API.
 */

export const RELAYER_PING = 'boot-ok';

export { MessageStore, nextRetryDelayMs } from './store.ts';
export { RelayerSigner } from './signer.ts';
export { Submitter } from './submitter.ts';
export type { DeliveryTransport, SubmitterOptions } from './submitter.ts';
export { WatcherEth, isEthEventFinal } from './watcher-eth.ts';
export type { EthBlockSource, EthLogEvent, WatcherEthOptions } from './watcher-eth.ts';
export { WatcherSol } from './watcher-sol.ts';
export type { SolEventSource, SolBridgeEvent, WatcherSolOptions } from './watcher-sol.ts';
export { checkI2, reconcileRequests, buildReconcileReport } from './reconciler.ts';
export {
  STATUS_API_ALLOWED_METHODS,
  getStatusApiAllowedMethods,
  createStatusApi,
  listenStatusApi,
} from './status-api.ts';
export type { StatusApiOptions, StatusPayload } from './status-api.ts';
export type * from './types.ts';
