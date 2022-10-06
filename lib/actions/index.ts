import type { ActionDefinition } from '@balena/jellyfish-worker';
import { actionHubotCalendar } from './action-hubot-calendar';
import { actionHubotEcho } from './action-hubot-echo';
import { actionHubotEmailHashtags } from './action-hubot-email-hashtags';
import { actionHubotLeave } from './action-hubot-leave';
import { actionHubotMeet } from './action-hubot-meet';
import { actionHubotRemind } from './action-hubot-remind';
import { actionHubotThreadWidePing } from './action-hubot-thread-wide-ping';
import { actionHubotTimezone } from './action-hubot-timezone';

export const actions: ActionDefinition[] = [
	actionHubotCalendar,
	actionHubotEcho,
	actionHubotEmailHashtags,
	actionHubotLeave,
	actionHubotMeet,
	actionHubotRemind,
	actionHubotThreadWidePing,
	actionHubotTimezone,
];
