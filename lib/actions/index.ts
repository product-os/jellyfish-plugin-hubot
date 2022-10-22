import type { ActionDefinition } from '@balena/jellyfish-worker';
import { actionHubotBrainstormHashtags } from './action-hubot-brainstorm-hashtags';
import { actionHubotCalendar } from './action-hubot-calendar';
import { actionHubotEcho } from './action-hubot-echo';
import { actionHubotEmailHashtags } from './action-hubot-email-hashtags';
import { actionHubotHelp } from './action-hubot-help';
import { actionHubotLeave } from './action-hubot-leave';
import { actionHubotListBrainstormHashtags } from './action-hubot-list-brainstorm-hashtags';
import { actionHubotListEmailHashtags } from './action-hubot-list-email-hashtags';
import { actionHubotMeet } from './action-hubot-meet';
import { actionHubotRemind } from './action-hubot-remind';
import { actionHubotSupportList } from './action-hubot-support-list';
import { actionHubotSupportMentions } from './action-hubot-support-mentions';
import { actionHubotSupportNotify } from './action-hubot-support-notify';
import { actionHubotThreadWidePing } from './action-hubot-thread-wide-ping';
import { actionHubotTimezone } from './action-hubot-timezone';

export const actions: ActionDefinition[] = [
	actionHubotBrainstormHashtags,
	actionHubotCalendar,
	actionHubotEcho,
	actionHubotEmailHashtags,
	actionHubotHelp,
	actionHubotLeave,
	actionHubotListBrainstormHashtags,
	actionHubotListEmailHashtags,
	actionHubotMeet,
	actionHubotRemind,
	actionHubotSupportList,
	actionHubotSupportMentions,
	actionHubotSupportNotify,
	actionHubotThreadWidePing,
	actionHubotTimezone,
];
