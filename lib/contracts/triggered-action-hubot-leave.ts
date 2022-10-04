import type { TriggeredActionContractDefinition } from '@balena/jellyfish-worker';

export const triggeredActionHubotLeave: TriggeredActionContractDefinition = {
	slug: 'triggered-action-hubot-leave',
	type: 'triggered-action@1.0.0',
	name: 'Triggered action for hubot leave',
	markers: [],
	data: {
		filter: {
			type: 'object',
			$$links: {
				'is attached to': {
					type: 'object',
					required: ['type'],
					properties: {
						type: {
							type: 'string',
							const: 'thread@1.0.0',
						},
					},
				},
				'was created by': {
					type: 'object',
					required: ['type'],
					properties: {
						type: {
							type: 'string',
							const: 'user@1.0.0',
						},
					},
					$$links: {
						'is member of': {
							type: 'object',
							required: ['type', 'slug'],
							properties: {
								type: {
									type: 'string',
									const: 'org@1.0.0',
								},
								slug: {
									type: 'string',
									const: 'org-balena',
								},
							},
						},
					},
				},
			},
			required: ['type', 'data'],
			properties: {
				type: {
					type: 'string',
					enum: ['message@1.0.0', 'whisper@1.0.0'],
				},
				data: {
					type: 'object',
					required: ['payload'],
					properties: {
						payload: {
							type: 'object',
							required: ['message'],
							properties: {
								message: {
									type: 'string',
									pattern:
										"(?:^@hubot\\s+who[']?s\\s+(?:on\\s+leave|off\\s+today)|(?:^@|\\s@)(?!hubot)[a-zA-Z0-9-]+)",
								},
							},
						},
					},
				},
			},
		},
		action: 'action-hubot-leave@1.0.0',
		target: {
			$eval: 'source.id',
		},
		arguments: {
			thread: {
				$eval: "source.links['is attached to'][0].id",
			},
		},
	},
};
