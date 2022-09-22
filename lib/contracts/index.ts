import type { ContractDefinition } from 'autumndb';
import { triggeredActionHubotEcho } from './triggered-action-hubot-echo';
import { triggeredActionHubotMeet } from './triggered-action-hubot-meet';
import { triggeredActionHubotTimezone } from './triggered-action-hubot-timezone';

export const contracts: ContractDefinition[] = [
	triggeredActionHubotEcho,
	triggeredActionHubotMeet,
	triggeredActionHubotTimezone,
];
