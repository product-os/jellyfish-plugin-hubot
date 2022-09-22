import type { ActionDefinition } from '@balena/jellyfish-worker';
import { actionHubotEcho } from './action-hubot-echo';
import { actionHubotTimezone } from './action-hubot-timezone';

export const actions: ActionDefinition[] = [
	actionHubotEcho,
	actionHubotTimezone,
];
