/**
 * React / Remotion に依存しない入口。
 * spec の検品を CI や CLI から単体で走らせるため（レンダーせずに構成の破綻を落とす）。
 */
export * from './spec';
export * from './lint';
