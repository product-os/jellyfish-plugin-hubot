import type { ActionDefinition } from '@balena/jellyfish-worker';
import { strict as assert } from 'assert';
import type { TypeContract } from 'autumndb';

const message = `\`#<inbox> <subject>\` - sends an email to the specified inbox, with a link back to the thread
\`#<tag> <subject>\` - creates a brainstorm-topic contract, with a link back to the thread
\`@hubot echo test\` - echos a given message
\`@hubot help\` - show command usage help
\`@hubot remind <user> in|on <time> to <do something>\` - create a reminder for the future
\`@hubot what time is 1pm from London to Athens\` - will tell you the converted time
\`@hubot what time is 1pm in Athens\` - will tell you the converted time
\`@hubot what time is it in Athens\` - will tell you the current time, converted
\`@hubot who's off today\` - responds with the names of the people that are on leave and the date of their return
\`@hubot who's on support\` - responds with the person in support at this specific time
\`@hubot, what are your brainstorm hashtags\` - lists the brainstorm hashtags and corresponding topic categories
\`@hubot, what are your hashtags\` - lists the inboxes that Hubot is configured to send hashtags to
\`@support-now\` - pings everyone on support right now
\`@support-today\` - pings everyone on support today
\`get a meet\` - responds with a link to a Google meet`;

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

	const date = new Date();
	await context.insertCard(
		context.privilegedSession,
		actionRequest as TypeContract,
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
						message,
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

export const actionHubotHelp: ActionDefinition = {
	handler,
	contract: {
		slug: 'action-hubot-help',
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
