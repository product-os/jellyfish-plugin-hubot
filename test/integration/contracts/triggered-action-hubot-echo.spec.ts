import { testUtils as wTestUtils } from '@balena/jellyfish-worker';
import { strict as assert } from 'assert';
import { testUtils as aTestUtils } from 'autumndb';
import { setTimeout as delay } from 'timers/promises';
import { v4 as uuid } from 'uuid';
import { createUser } from './utils';
import { hubotPlugin } from '../../../lib';

let ctx: wTestUtils.TestContext;
let hubot: any;
let balenaOrg: any;

beforeAll(async () => {
	ctx = await wTestUtils.newContext({
		plugins: [hubotPlugin()],
	});

	hubot = await ctx.kernel.getContractBySlug(
		ctx.logContext,
		ctx.session,
		'user-hubot@latest',
	);
	assert(hubot, 'hubot user not found');

	balenaOrg = await ctx.kernel.getContractBySlug(
		ctx.logContext,
		ctx.session,
		'org-balena@1.0.0',
	);
	assert(balenaOrg, 'org-balena not found');
});

afterAll(() => {
	return wTestUtils.destroyContext(ctx);
});

test('echos are created for balena user messages', async () => {
	// Prepare necessary users
	const user = await createUser(ctx, balenaOrg);

	// Assert echo whisper created from request in message
	const text = aTestUtils.generateRandomId();
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
		`@hubot echo ${text}`,
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
								const: text,
							},
						},
					},
				},
			},
		},
	});
});

test('echos are created for balena user whispers', async () => {
	// Prepare necessary users
	const user = await createUser(ctx, balenaOrg);

	// Assert echo whisper created from request in whisper
	const text = aTestUtils.generateRandomId();
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
		`@hubot echo ${text}`,
		'whisper',
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
								const: text,
							},
						},
					},
				},
			},
		},
	});
});

test('echo requests are ignored for non-balena users', async () => {
	// Prepare necessary users
	const org = await ctx.createOrg(aTestUtils.generateRandomId().split('-')[0]);
	const user = await createUser(ctx, org);

	// Create echo request with non-balena user
	const text = aTestUtils.generateRandomId();
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
		`@hubot echo ${text}`,
		'message',
	);

	// Wait a few seconds to ensure no response is sent
	await delay(3000);

	const matches = await ctx.kernel.query(
		ctx.logContext,
		ctx.session,
		{
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
		},
		{
			limit: 1,
		},
	);
	expect(matches.length).toBe(0);
});
