import type { ContractDefinition } from 'autumndb';
import { triggeredActionHubotEcho } from './triggered-action-hubot-echo';
import { triggeredActionHubotMeet } from './triggered-action-hubot-meet';
import { triggeredActionHubotTimezone } from './triggered-action-hubot-timezone';
import { triggeredActionHubotEmailHashtags } from './triggered-action-hubot-email-hashtags';

export const contracts: ContractDefinition[] = [
	triggeredActionHubotEcho,
	triggeredActionHubotEmailHashtags,
	triggeredActionHubotMeet,
	triggeredActionHubotTimezone,
];
