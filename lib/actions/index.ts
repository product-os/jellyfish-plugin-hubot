import type { ActionDefinition } from '@balena/jellyfish-worker';
import { actionHubotEcho } from './action-hubot-echo';
import { actionHubotEmailHashtags } from './action-hubot-email-hashtags';
import { actionHubotMeet } from './action-hubot-meet';
import { actionHubotThreadWidePing } from './action-hubot-thread-wide-ping';
import { actionHubotTimezone } from './action-hubot-timezone';

export const actions: ActionDefinition[] = [
	actionHubotEcho,
	actionHubotEmailHashtags,
	actionHubotMeet,
	actionHubotThreadWidePing,
	actionHubotTimezone,
];
