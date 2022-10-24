import type { ContractDefinition } from 'autumndb';

export const hubotNotification: ContractDefinition = {
	slug: 'hubot-notification',
	type: 'type@1.0.0',
	name: 'Hubot notification',
	markers: [],
	data: {
		schema: {
			type: 'object',
			required: ['data'],
			properties: {
				data: {
					type: 'object',
					required: ['event'],
					properties: {
						event: {
							type: 'string',
						},
						type: {
							type: 'string',
						},
					},
				},
			},
		},
		indexed_fields: [['data.event'], ['data.type']],
	},
};
