import { ActionDefinition, errors } from '@balena/jellyfish-worker';
import { strict as assert } from 'assert';
import type { TypeContract } from 'autumndb';

const handler: ActionDefinition['handler'] = async (
	_session,
	context,
	contract,
	request,
) => {
	// Get required type
	const actionRequestType = await context.getCardBySlug(
		context.privilegedSession,
		'action-request@1.0.0',
	);
	assert(
		actionRequestType,
		new errors.SyncNoElement('Type not found: action-request'),
	);

	// Get hubot user
	const hubot = await context.getCardBySlug(
		context.privilegedSession,
		'user-hubot@1.0.0',
	);
	assert(
		hubot,
		new errors.SyncNoElement('Internal user not found: user-hubot'),
	);

	const date = new Date();
	await context.insertCard(
		context.privilegedSession,
		actionRequestType as TypeContract,
		{
			actor: hubot.id,
			timestamp: date.toISOString(),
			attachEvents: true,
		},
		{
			data: {
				actor: hubot.id,
				context: request.logContext,
				action: 'action-create-event@1.0.0',
				card: request.arguments.thread,
				type: 'thread@1.0.0',
				epoch: date.valueOf(),
				timestamp: date.toISOString(),
				input: {
					id: request.arguments.thread,
				},
				arguments: {
					type: 'whisper',
					payload: {
						message: (contract.data.payload as any).message.replace(
							'@hubot echo ',
							'',
						),
					},
				},
			},
		},
	);

	return {
		id: contract.id,
		type: contract.type,
		version: contract.version,
		slug: contract.slug,
	};
};

export const actionHubotEcho: ActionDefinition = {
	handler,
	contract: {
		slug: 'action-hubot-echo',
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
