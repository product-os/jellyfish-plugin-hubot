import { testUtils as wTestUtils } from '@balena/jellyfish-worker';
import { strict as assert } from 'assert';
import { v4 as uuid } from 'uuid';
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

test('reminders are created for balena users', async () => {
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
	const user = ctx.session.actor;
	await ctx.createLink(balenaOrg, user, 'has member', 'is member of');

	// Assert echo whisper created from request in message
	const thread = await ctx.createContract(
		user.id,
		{ actor: user },
		'thread@1.0.0',
		uuid(),
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

	// Assert that the expected confirmation whisper was created
	const confirmation = await ctx.waitForMatch({
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
	expect(
		(confirmation.data.payload as any).message.includes('to do this ^^^'),
	).toBe(true);
});
