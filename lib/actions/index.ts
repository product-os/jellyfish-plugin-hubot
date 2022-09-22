import type { ActionDefinition } from '@balena/jellyfish-worker';
import { actionHubotEcho } from './action-hubot-echo';

export const actions: ActionDefinition[] = [actionHubotEcho];
