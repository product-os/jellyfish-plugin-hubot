import { defaultEnvironment } from '@balena/jellyfish-environment';
import type { ActionDefinition } from '@balena/jellyfish-worker';
import { strict as assert } from 'assert';
import type { TypeContract, UserContract } from 'autumndb';
import { createWhisper } from './utils';

const env = defaultEnvironment.hubot.emailHashtags;

const handler: ActionDefinition['handler'] = async (
	_session,
	context,
	contract,
	request,
) => {
	// Get required contracts
	const actionRequest = context.cards['action-request@1.0.0'] as TypeContract;
	assert(actionRequest, 'action-request type not found');
	const hubot = await context.getCardBySlug(
		context.privilegedSession,
		'user-hubot@1.0.0',
	);
	assert(hubot, 'user-hubot not found');

	const list: string[] = [];
	const hashtags = JSON.parse(env.hashtags);
	for (const hashtag of Object.keys(hashtags)) {
		list.push(`${hashtag}: ${hashtags[hashtag]}@${env.domain}`);
	}

	await createWhisper(
		request.logContext,
		context,
		actionRequest as TypeContract,
		hubot as UserContract,
		request.arguments.thread,
		list.join('\n'),
	);

	return {
		id: contract.id,
		type: contract.type,
		version: contract.version,
		slug: contract.slug,
	};
};

export const actionHubotListEmailHashtags: ActionDefinition = {
	handler,
	contract: {
		slug: 'action-hubot-list-email-hashtags',
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
