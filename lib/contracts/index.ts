import type { ContractDefinition } from 'autumndb';
import { scheduledActionHubotCalendar } from './scheduled-action-hubot-calendar';
import { triggeredActionHubotEcho } from './triggered-action-hubot-echo';
import { triggeredActionHubotEmailHashtags } from './triggered-action-hubot-email-hashtags';
import { triggeredActionHubotLeave } from './triggered-action-hubot-leave';
import { triggeredActionHubotMeet } from './triggered-action-hubot-meet';
import { triggeredActionHubotRemind } from './triggered-action-hubot-remind';
import { triggeredActionHubotTimezone } from './triggered-action-hubot-timezone';
import { triggeredActionHubotThreadWidePing } from './triggered-action-hubot-thread-wide-ping';

export const contracts: ContractDefinition[] = [
	scheduledActionHubotCalendar,
	triggeredActionHubotEcho,
	triggeredActionHubotEmailHashtags,
	triggeredActionHubotLeave,
	triggeredActionHubotMeet,
	triggeredActionHubotRemind,
	triggeredActionHubotTimezone,
	triggeredActionHubotThreadWidePing,
];
