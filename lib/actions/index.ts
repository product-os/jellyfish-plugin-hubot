import type { ActionDefinition } from '@balena/jellyfish-worker';
import { actionHubotEcho } from './action-hubot-echo';
import { actionHubotMeet } from './action-hubot-meet';
import { actionHubotTimezone } from './action-hubot-timezone';

export const actions: ActionDefinition[] = [
	actionHubotEcho,
	actionHubotMeet,
	actionHubotTimezone,
];
