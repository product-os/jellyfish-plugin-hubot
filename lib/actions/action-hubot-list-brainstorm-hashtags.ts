import type { ActionDefinition } from '@balena/jellyfish-worker';
import { strict as assert } from 'assert';
import type { TypeContract, UserContract } from 'autumndb';
import * as _ from 'lodash';
import {
	topicHashtags,
	topicHashtagsToString,
} from './action-hubot-brainstorm-hashtags';
import { createWhisper } from './utils';

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

	await createWhisper(
		request.logContext,
		context,
		actionRequest as TypeContract,
		hubot as UserContract,
		request.arguments.thread,
		topicHashtagsToString(topicHashtags),
	);

	return {
		id: contract.id,
		type: contract.type,
		version: contract.version,
		slug: contract.slug,
	};
};

export const actionHubotListBrainstormHashtags: ActionDefinition = {
	handler,
	contract: {
		slug: 'action-hubot-list-brainstorm-hashtags',
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
