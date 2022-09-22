import { testUtils as workerTestUtils } from '@balena/jellyfish-worker';
import { strict as assert } from 'assert';
import { testUtils as autumndbTestUtils } from 'autumndb';
import { hubotPlugin } from '../../../lib';

let ctx: workerTestUtils.TestContext;

beforeAll(async () => {
	ctx = await workerTestUtils.newContext({
		plugins: [hubotPlugin()],
	});
}, 10000);

afterAll(() => {
	return workerTestUtils.destroyContext(ctx);
});

test('Echo whisper is created from request in message', async () => {
	const text = autumndbTestUtils.generateRandomId().split('-')[0];
	const thread = await ctx.createContract(
		ctx.adminUserId,
		ctx.session,
		'thread@1.0.0',
		'foobar',
		{},
	);
	await ctx.createEvent(
		ctx.adminUserId,
		ctx.session,
		thread,
		`@hubot echo ${text}`,
		'message',
	);
	await ctx.flushAll(ctx.session);

	const hubot = await ctx.kernel.getContractBySlug(
		ctx.logContext,
		ctx.session,
		'user-hubot@latest',
	);
	assert(hubot, 'Hubot user not found');

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
								const: text,
							},
						},
					},
				},
			},
		},
	});
});
