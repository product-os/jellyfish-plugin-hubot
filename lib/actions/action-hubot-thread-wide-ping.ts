import { ActionDefinition, errors } from '@balena/jellyfish-worker';
import { strict as assert } from 'assert';
import type { TypeContract } from 'autumndb';
import * as _ from 'lodash';

const handler: ActionDefinition['handler'] = async (
	session,
	context,
	contract,
	request,
) => {
	// Get required contracts
	const actionRequest = context.cards['action-request@1.0.0'] as TypeContract;
	assert(actionRequest, 'action-request type not found');
	const actor = await context.getCardById(
		context.privilegedSession,
		(contract.data as any).actor,
	);
	assert(actor, `actor not found: ${contract.data.actor}`);

	// Prepare results to be returned
	const results = {
		id: contract.id,
		type: contract.type,
		version: contract.version,
		slug: contract.slug,
	};

	// Get thread contract and all attached messages/whispers
	const thread = await context.query(
		session,
		{
			type: 'object',
			required: ['id', 'type'],
			properties: {
				type: {
					const: 'thread@1.0.0',
				},
				id: {
					const: request.arguments.thread,
				},
			},
			$$links: {
				'has attached element': {
					type: 'object',
					required: ['type', 'data'],
					properties: {
						type: {
							enum: ['message@1.0.0', 'whisper@1.0.0'],
						},
					},
				},
			},
		},
		{
			limit: 1,
		},
	);
	assert(
		thread[0] &&
			thread[0].links &&
			thread[0].links['has attached element'] &&
			thread[0].links['has attached element'].length > 0,
		new errors.WorkerNoElement(
			`Expected thread not found: ${request.arguments.thread}`,
		),
	);

	// Add thread message/whisper authors to mention targets
	// Only include users that are member so of the balena org
	const exclusions = [
		'@t',
		'@thread',
		'@people',
		'@hubot',
		actor.slug.replace(/^user-/, '@'),
	];
	const authors: string[] = [];
	for (const event of thread[0].links['has attached element']) {
		if (!authors.includes((event.data as any).actor)) {
			authors.push((event.data as any).actor);
		}
	}
	const mentions = _.compact(
		await Promise.all(
			authors.map(async (id: string) => {
				const author = await context.query(
					session,
					{
						type: 'object',
						required: ['id'],
						properties: {
							id: {
								const: id,
							},
						},
						$$links: {
							'is member of': {
								type: 'object',
								required: ['type', 'slug'],
								properties: {
									type: {
										const: 'org@1.0.0',
									},
									slug: {
										const: 'org-balena',
									},
								},
							},
						},
					},
					{
						limit: 1,
					},
				);
				if (author && author[0]) {
					const mention = author[0].slug.replace(/^user-/, '@');
					if (!exclusions.includes(mention)) {
						return mention;
					}
				}
			}),
		),
	);

	// Add thread message/whisper mentions to mention targets
	const mentioned: string[] = [];
	for (const event of thread[0].links['has attached element']) {
		const mentionsUser: string[] = (event.data.payload as any).mentionsUser;
		if (mentionsUser && mentionsUser.length > 0) {
			for (const slug of mentionsUser) {
				const mention = slug.replace(/^user-/, '@');
				if (!mentions.includes(mention) && !exclusions.includes(mention)) {
					mentioned.push(slug);
				}
			}
		}
	}
	await Promise.all(
		mentioned.map(async (slug) => {
			const matches = await context.query(
				session,
				{
					type: 'object',
					required: ['type', 'slug'],
					properties: {
						type: {
							const: 'user@1.0.0',
						},
						slug: {
							const: slug,
						},
					},
					$$links: {
						'is member of': {
							type: 'object',
							required: ['type', 'slug'],
							properties: {
								type: {
									const: 'org@1.0.0',
								},
								slug: {
									const: 'org-balena',
								},
							},
						},
					},
				},
				{
					limit: 1,
				},
			);
			if (matches && matches[0]) {
				const mention = matches[0].slug.replace(/^user-/, '@');
				if (!exclusions.includes(mention)) {
					mentions.push(mention);
				}
			}
		}),
	);

	// Return if there are no mentions to update with
	if (mentions.length < 1) {
		return results;
	}

	// Remove all user mentions from current message string
	const updatedMessage = `${(contract.data.payload as any).message
		.replace(/(?:^|\s+)@[a-zA-Z-_0-9]+/g, '')
		.trim()} ${mentions.sort().join(' ')}`;

	// Patch original message/whisper
	const date = new Date();
	await context.insertCard(
		context.privilegedSession,
		actionRequest as TypeContract,
		{
			actor: actor.id,
			timestamp: date.toISOString(),
			attachEvents: true,
		},
		{
			data: {
				actor: actor.id,
				context: request.logContext,
				action: 'action-update-card@1.0.0',
				card: contract.id,
				type: contract.type,
				epoch: date.valueOf(),
				timestamp: date.toISOString(),
				input: {
					id: contract.id,
				},
				arguments: {
					reason: 'set thread-wide ping',
					patch: [
						{
							op: 'replace',
							path: '/data/payload/message',
							value: updatedMessage,
						},
					],
				},
			},
		},
	);

	return results;
};

export const actionHubotThreadWidePing: ActionDefinition = {
	handler,
	contract: {
		slug: 'action-hubot-thread-wide-ping',
		version: '1.0.0',
		type: 'action@1.0.0',
		data: {
			filter: {
				type: 'object',
				required: ['type'],
				properties: {
					type: {
						type: 'string',
						enum: ['message@1.0.0', 'whisper@1.0.0'],
					},
				},
			},
			arguments: {
				thread: {
					type: 'string',
				},
			},
		},
	},
};
