import type { ContractDefinition } from 'autumndb';
import { triggeredActionHubotEcho } from './triggered-action-hubot-echo';
import { triggeredActionHubotMeet } from './triggered-action-hubot-meet';
import { triggeredActionHubotTimezone } from './triggered-action-hubot-timezone';
import { triggeredActionHubotEmailHashtags } from './triggered-action-hubot-email-hashtags';
import { triggeredActionHubotThreadWidePing } from './triggered-action-hubot-thread-wide-ping';

export const contracts: ContractDefinition[] = [
	triggeredActionHubotEcho,
	triggeredActionHubotEmailHashtags,
	triggeredActionHubotMeet,
	triggeredActionHubotTimezone,
	triggeredActionHubotThreadWidePing,
];
