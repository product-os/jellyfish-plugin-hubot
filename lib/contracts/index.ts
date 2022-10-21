import type { ContractDefinition } from 'autumndb';
import { triggeredActionHubotBrainstormHashtags } from './triggered-action-hubot-brainstorm-hashtags';
import { scheduledActionHubotCalendar } from './scheduled-action-hubot-calendar';
import { scheduledActionHubotSupportNotify } from './scheduled-action-hubot-support-notify';
import { triggeredActionHubotEcho } from './triggered-action-hubot-echo';
import { triggeredActionHubotEmailHashtags } from './triggered-action-hubot-email-hashtags';
import { triggeredActionHubotHelp } from './triggered-action-hubot-help';
import { triggeredActionHubotLeave } from './triggered-action-hubot-leave';
import { triggeredActionHubotListBrainstormHashtags } from './triggered-action-hubot-list-brainstorm-hashtags';
import { triggeredActionHubotMeet } from './triggered-action-hubot-meet';
import { triggeredActionHubotRemind } from './triggered-action-hubot-remind';
import { triggeredActionHubotSupportList } from './triggered-action-hubot-support-list';
import { triggeredActionHubotTimezone } from './triggered-action-hubot-timezone';
import { triggeredActionHubotThreadWidePing } from './triggered-action-hubot-thread-wide-ping';

export const contracts: ContractDefinition[] = [
	triggeredActionHubotBrainstormHashtags,
	scheduledActionHubotCalendar,
	scheduledActionHubotSupportNotify,
	triggeredActionHubotEcho,
	triggeredActionHubotEmailHashtags,
	triggeredActionHubotHelp,
	triggeredActionHubotLeave,
	triggeredActionHubotListBrainstormHashtags,
	triggeredActionHubotMeet,
	triggeredActionHubotRemind,
	triggeredActionHubotSupportList,
	triggeredActionHubotTimezone,
	triggeredActionHubotThreadWidePing,
];
