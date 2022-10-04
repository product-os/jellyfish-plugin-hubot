import type { ContractDefinition } from 'autumndb';
import { triggeredActionHubotEcho } from './triggered-action-hubot-echo';
import { triggeredActionHubotEmailHashtags } from './triggered-action-hubot-email-hashtags';
import { triggeredActionHubotLeave } from './triggered-action-hubot-leave';
import { triggeredActionHubotMeet } from './triggered-action-hubot-meet';
import { triggeredActionHubotTimezone } from './triggered-action-hubot-timezone';
import { triggeredActionHubotThreadWidePing } from './triggered-action-hubot-thread-wide-ping';

export const contracts: ContractDefinition[] = [
	triggeredActionHubotEcho,
	triggeredActionHubotEmailHashtags,
	triggeredActionHubotLeave,
	triggeredActionHubotMeet,
	triggeredActionHubotTimezone,
	triggeredActionHubotThreadWidePing,
];
