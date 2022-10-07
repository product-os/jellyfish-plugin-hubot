import { defaultEnvironment } from '@balena/jellyfish-environment';
import type { ScheduledActionContractDefinition } from '@balena/jellyfish-worker';

export const scheduledActionHubotSupportNotify: ScheduledActionContractDefinition =
	{
		slug: 'scheduled-action-hubot-support-notify',
		type: 'scheduled-action@1.0.0',
		name: 'Scheduled action for hubot support notify',
		markers: [],
		data: {
			options: {
				action: 'action-hubot-support-notify@1.0.0',
				arguments: {
					thread: defaultEnvironment.hubot.support.thread,
				},
			},
			schedule: {
				recurring: {
					start: '2022-10-01T00:00:00.000Z',
					end: '2032-10-01T00:00:00.000Z',
					interval: '*/5 * * * *',
				},
			},
		},
	};
