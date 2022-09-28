import type { TriggeredActionContractDefinition } from '@balena/jellyfish-worker';

export const triggeredActionHubotEmailHashtags: TriggeredActionContractDefinition =
	{
		slug: 'triggered-action-hubot-email-hashtags',
		type: 'triggered-action@1.0.0',
		name: 'Triggered action for hubot email hashtags',
		markers: [],
		data: {
			filter: {
				type: 'object',
				$$links: {
					'is attached to': {
						type: 'object',
						required: ['active', 'type'],
						properties: {
							active: {
								type: 'boolean',
								const: true,
							},
							type: {
								type: 'string',
								const: 'thread@1.0.0',
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
										pattern: '#[a-z-]+\\s+',
									},
								},
							},
						},
					},
				},
			},
			action: 'action-hubot-email-hashtags@1.0.0',
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
