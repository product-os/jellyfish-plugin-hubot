import type { ActionDefinition } from '@balena/jellyfish-worker';
import { strict as assert } from 'assert';
import type { TypeContract, UserContract } from 'autumndb';
import * as _ from 'lodash';
import { v4 as uuid } from 'uuid';
import { createWhisper } from './utils';

interface Map<T> {
	[key: string]: T;
}

const MIN_WORDS = 4;
const MAX_WORDS = 64;
const LOOPS: string[] = [
	'team-os',
	'product-os',
	'company-os',
	'balenalabs',
	'balena-io',
];

/**
 * A map of hashtags to the topic category they should create
 */
export const topicHashtags: Map<string> = {
	// Focus-specific (intrinsic) product topics (default loop)
	outreach: 'balena-io outreach',
	commercial: 'balena-io commercial',

	// Focus-specific architecture/product topics (default loop)
	'(hw|hardware)-arch(itecture)?': 'balena-io hardware architecture',
	'(hw|hardware)-prod(uct)?': 'balena-io hardware product',
};

// Loop-specific arch/product topics
LOOPS.forEach((loop) => {
	topicHashtags[`${loop}-arch(itecture)?`] = `${loop} architecture`;
	topicHashtags[`${loop}-prod(uct)?`] = `${loop} product`;
});

export function topicHashtagsToString(hashtags: Map<string>): string {
	return _.map(hashtags, (category, hashtag) => {
		return `* ${hashtag} => ${category}`;
	})
		.sort()
		.join('\n');
}

const handler: ActionDefinition['handler'] = async (
	session,
	context,
	contract,
	request,
) => {
	// Get required contracts
	const actionRequest = context.cards['action-request@1.0.0'] as TypeContract;
	assert(actionRequest, 'action-request type not found');
	const brainstormTopic = context.cards[
		'brainstorm-topic@1.0.0'
	] as TypeContract;
	assert(brainstormTopic, 'brainstorm-topic type not found');
	const [hubot, actor] = await Promise.all([
		context.getCardBySlug(context.privilegedSession, 'user-hubot@1.0.0'),
		context.getCardById(session, contract.data.actor as string),
	]);
	assert(hubot, 'user-hubot not found');
	assert(actor, `Unable to get actor contract: ${contract.data.actor}`);

	// Get hashtag from message
	const message = (contract.data.payload as any).message.trim() as string;
	const match = message.match(/#[a-z-]+-(arch|prod)/);
	assert(match && match[0], 'Failed to get brainstorm hashtag');
	const tag = match[0].replace(/^#/, '');

	// Get category from hashtag
	const category: string =
		_.find(topicHashtags, (_category: string, hashtagRegExp: string) => {
			return Boolean(tag.match(`^${hashtagRegExp}$`));
		}) || 'balena-io';

	// Get source URL
	const thread = await context.getCardById(session, request.arguments.thread);
	assert(thread, `Unable to get thread contract: ${request.arguments.thread}`);
	const sourceUrl = `https://jel.ly.fish/${thread.slug}`;

	// Parse non-hashtag text from message
	const firstLine = message
		.trim()
		.split(/[\r\n]+/)[0]
		.replace(`#${tag}`, '')
		.trim();
	const firstLineWords = firstLine.match(/\w+/g)?.length || 0;
	const totalWords = message.match(/\w+/g)?.length || 0;

	// Check message length
	let response = '';
	if (totalWords <= MIN_WORDS) {
		response = `Your message is too short. It must be more than ${MIN_WORDS} words. You wrote ${totalWords} words.`;
	} else if (firstLineWords >= MAX_WORDS) {
		response = `First line (summary) is too long. It must be less than ${MAX_WORDS} words. You wrote ${firstLineWords} words.`;
	}
	if (response.length) {
		await createWhisper(
			request.logContext,
			context,
			actionRequest,
			hubot as UserContract,
			request.arguments.thread,
			response,
		);
	} else {
		// No message length issues, so go ahead and create a brainstorm
		const date = new Date();
		const created = await context.insertCard(
			context.privilegedSession,
			brainstormTopic,
			{
				actor: actor.id,
				timestamp: date.toISOString(),
				attachEvents: false,
			},
			{
				slug: `brainstorm-topic-${uuid()}`,
				name: firstLine,
				loop: `loop-${category.split(' ')[0]}@1.0.0`,
				type: brainstormTopic.slug,
				version: '1.0.0',
				data: {
					status: 'open',
					sourceUrl,
					reporter: actor.slug,
					category,
					description: message,
				},
			},
		);
		assert(created, 'Failed to create brainstorm topic');
		await createWhisper(
			request.logContext,
			context,
			actionRequest,
			hubot as UserContract,
			request.arguments.thread,
			`'${category}' brainstorm topic created in Jellyfish: https://jel.ly.fish/${created.slug}`,
		);
	}

	return {
		id: contract.id,
		type: contract.type,
		version: contract.version,
		slug: contract.slug,
	};
};

export const actionHubotBrainstormHashtags: ActionDefinition = {
	handler,
	contract: {
		slug: 'action-hubot-brainstorm-hashtags',
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
