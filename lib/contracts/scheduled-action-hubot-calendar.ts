import type { ScheduledActionContractDefinition } from '@balena/jellyfish-worker';

export const scheduledActionHubotCalendar: ScheduledActionContractDefinition = {
	slug: 'scheduled-action-hubot-calendar',
	type: 'scheduled-action@1.0.0',
	name: 'Scheduled action for hubot calendar',
	markers: [],
	data: {
		options: {
			action: 'action-hubot-calendar@1.0.0',
		},
		schedule: {
			recurring: {
				start: '2022-10-01T00:00:00.000Z',
				end: '2032-10-01T00:00:00.000Z',
				interval: '0/30 * * * *',
			},
		},
	},
};
