import { testUtils as wTestUtils } from '@balena/jellyfish-worker';
import { strict as assert } from 'assert';
import { randomUUID } from 'node:crypto';
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

test('reminders are created', async () => {
	// Prepare necessary users
	const [hubot, balenaOrg, user] = await Promise.all([
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
		ctx.createUser('foo'),
	]);
	assert(hubot, 'user-hubot not found');
	assert(balenaOrg, 'org-balena not found');
	await ctx.createLink(balenaOrg, user, 'has member', 'is member of');

	// Create a reminder
	const thread = await ctx.createContract(
		user.id,
		{ actor: user },
		'thread@1.0.0',
		randomUUID(),
		{},
	);
	await ctx.createEvent(
		user.id,
		{ actor: user },
		thread,
		'@hubot remind me in 10 seconds',
		'message',
	);
	await ctx.flushAll(ctx.session);

	// Assert that the expected scheduled-action was created
	await ctx.waitForMatch({
		type: 'object',
		required: ['type', 'data'],
		properties: {
			type: {
				const: 'scheduled-action@1.0.0',
			},
			data: {
				type: 'object',
				required: ['options'],
				properties: {
					options: {
						type: 'object',
						required: ['actor', 'action', 'arguments'],
						properties: {
							actor: {
								const: hubot.id,
							},
							action: {
								const: 'action-create-event@1.0.0',
							},
							arguments: {
								type: 'object',
								required: ['type', 'payload'],
								properties: {
									type: {
										const: 'whisper',
									},
									payload: {
										type: 'object',
										required: ['message'],
										properties: {
											message: {
												const: `Hey @${user.slug.replace(
													/^user-/,
													'',
												)} remember to do this ^^^`,
											},
										},
									},
								},
							},
						},
					},
				},
			},
		},
	});

	// Assert that the expected reminder whisper was created
	const match = await ctx.waitForMatch({
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
								pattern: `Got it, will remind ${user.slug.replace(
									/^user-/,
									'',
								)} on`,
							},
						},
					},
				},
			},
		},
	});
	expect((match.data.payload as any).message.includes('to do this ^^^')).toBe(
		true,
	);
});
