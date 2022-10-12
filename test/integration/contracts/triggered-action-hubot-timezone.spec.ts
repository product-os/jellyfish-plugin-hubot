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

test('responds timezone requests', async () => {
	// Prepare necessary users
	const hubot = await ctx.kernel.getContractBySlug(
		ctx.logContext,
		ctx.session,
		'user-hubot@latest',
	);
	assert(hubot, 'user-hubot not found');
	const balenaOrg = await ctx.kernel.getContractBySlug(
		ctx.logContext,
		ctx.session,
		'org-balena@1.0.0',
	);
	assert(balenaOrg, 'org-balena not found');
	const user = await createUser(ctx, balenaOrg);

	// Test that hubot responds to timezone request messages
	let thread = await ctx.createContract(
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
		'@hubot what time is 1pm from London to Athens',
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
								pattern: '^[0-9]{1,2}:[0-9]{1,2}\\s+[A|P]M$',
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

	// Test that hubot responds to timezone request messages
	thread = await ctx.createContract(
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
		'@hubot what time is 1pm from London to Athens',
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
								type: 'string',
								pattern: '^[0-9]{1,2}:[0-9]{1,2}\\s+[A|P]M$',
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
