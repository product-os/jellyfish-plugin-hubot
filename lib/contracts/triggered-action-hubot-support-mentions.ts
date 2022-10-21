import type { TriggeredActionContractDefinition } from '@balena/jellyfish-worker';

export const triggeredActionHubotSupportMentions: TriggeredActionContractDefinition =
	{
		slug: 'triggered-action-hubot-support-mentions',
		type: 'triggered-action@1.0.0',
		name: 'Triggered action for hubot support mentions',
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
										pattern: '(?:\\s|^)(@support-now|@support-today)(?:\\s|$)',
									},
								},
							},
						},
					},
				},
			},
			action: 'action-hubot-support-mentions@1.0.0',
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
