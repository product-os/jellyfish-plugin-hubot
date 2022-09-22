import type { ContractDefinition } from 'autumndb';
import { triggeredActionHubotEcho } from './triggered-action-hubot-echo';
import { triggeredActionHubotTimezone } from './triggered-action-hubot-timezone';

export const contracts: ContractDefinition[] = [
	triggeredActionHubotEcho,
	triggeredActionHubotTimezone,
];
