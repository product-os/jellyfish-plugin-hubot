import * as dotenv from 'dotenv';
dotenv.config();

import { testUtils as workerTestUtils } from '@balena/jellyfish-worker';
import { strict as assert } from 'assert';
import * as nock from 'nock';
import { hubotPlugin } from '../../../lib';

let ctx: workerTestUtils.TestContext;

beforeAll(async () => {
	ctx = await workerTestUtils.newContext({
		plugins: [hubotPlugin()],
	});
}, 10000);

afterAll(() => {
	nock.cleanAll();
	return workerTestUtils.destroyContext(ctx);
});

test('Creates and responds with Google Meet URLs', async () => {
	const hangoutLink = 'https://foo.bar';
	nock('https://www.googleapis.com')
		.persist()
		.post(/\/oauth2\/./)
		.reply(200);
	nock('https://www.googleapis.com')
		.persist()
		.post(/\/calendar\/./)
		.reply(200, {
			hangoutLink,
		});

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
		'get a meet',
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
								const: hangoutLink,
							},
						},
					},
				},
			},
		},
	});
});
