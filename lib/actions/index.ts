import type { ActionDefinition } from '@balena/jellyfish-worker';
import { actionHubotCalendar } from './action-hubot-calendar';
import { actionHubotEcho } from './action-hubot-echo';
import { actionHubotEmailHashtags } from './action-hubot-email-hashtags';
import { actionHubotHelp } from './action-hubot-help';
import { actionHubotLeave } from './action-hubot-leave';
import { actionHubotMeet } from './action-hubot-meet';
import { actionHubotRemind } from './action-hubot-remind';
import { actionHubotSupportList } from './action-hubot-support-list';
import { actionHubotSupportNotify } from './action-hubot-support-notify';
import { actionHubotThreadWidePing } from './action-hubot-thread-wide-ping';
import { actionHubotTimezone } from './action-hubot-timezone';

export const actions: ActionDefinition[] = [
	actionHubotCalendar,
	actionHubotEcho,
	actionHubotEmailHashtags,
	actionHubotHelp,
	actionHubotLeave,
	actionHubotMeet,
	actionHubotRemind,
	actionHubotSupportList,
	actionHubotSupportNotify,
	actionHubotThreadWidePing,
	actionHubotTimezone,
];
