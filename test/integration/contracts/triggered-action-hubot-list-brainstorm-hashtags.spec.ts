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

test('lists brainstorm hashtags', async () => {
	// Prepare necessary users
	const [hubot, balenaOrg] = await Promise.all([
		ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			'user-hubot@latest',
		),
		ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			'org-balena@1.0.0',
		),
	]);
	assert(hubot, 'user-hubot not found');
	assert(balenaOrg, 'org-balena not found');
	const user = await createUser(ctx, balenaOrg);

	const thread = await ctx.createContract(
		user.id,
		{ actor: user },
		'thread@1.0.0',
		aTestUtils.generateRandomId(),
		{},
	);
	await ctx.createEvent(
		user.id,
		{ actor: user },
		thread,
		'@hubot what are your brainstorm hashtags?',
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
								type: 'string',
								pattern: 'product-os',
							},
						},
					},
				},
			},
		},
		$$links: {
			'is attached to': {
				type: 'object',
				required: ['id'],
				properties: {
					id: {
						const: thread.id,
					},
				},
			},
		},
	});
});
