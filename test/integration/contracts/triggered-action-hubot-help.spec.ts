import { testUtils as wTestUtils } from '@balena/jellyfish-worker';
import { strict as assert } from 'assert';
import { testUtils as aTestUtils } from 'autumndb';
import { createUser } from './utils';
import { hubotPlugin } from '../../../lib';

let ctx: wTestUtils.TestContext;

beforeAll(async () => {
	ctx = await wTestUtils.newContext({
		plugins: [hubotPlugin()],
	});
});

afterAll(() => {
	return wTestUtils.destroyContext(ctx);
});

test('returns help message', async () => {
	// Prepare necessary users
	const hubot = await ctx.kernel.getContractBySlug(
		ctx.logContext,
		ctx.session,
		'user-hubot@latest',
	);
	assert(hubot, 'hubot user not found');
	const balenaOrg = await ctx.kernel.getContractBySlug(
		ctx.logContext,
		ctx.session,
		'org-balena@1.0.0',
	);
	assert(balenaOrg, 'org-balena not found');
	const user = await createUser(ctx, balenaOrg);

	// Create thread to post on
	const thread = await ctx.createContract(
		user.id,
		{ actor: user },
		'thread@1.0.0',
		aTestUtils.generateRandomId(),
		{},
	);

	// Assert responses to messages
	await ctx.createEvent(
		user.id,
		{ actor: user },
		thread,
		'@hubot help',
		'message',
	);
	await ctx.waitForMatch({
		type: 'object',
		required: ['type', 'data'],
		properties: {
			type: {
				const: 'whisper@1.0.0',
			},
			data: {
				type: 'object',
				required: ['actor', 'payload'],
				properties: {
					actor: {
						const: hubot.id,
					},
					payload: {
						type: 'object',
						required: ['message'],
						properties: {
							message: {
								pattern: 'sends an email',
							},
						},
					},
				},
			},
		},
	});
});
