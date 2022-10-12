import { testUtils as wTestUtils } from '@balena/jellyfish-worker';
import { strict as assert } from 'assert';
import { testUtils as aTestUtils } from 'autumndb';
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

test('sets thread-wide ping on @t mention', async () => {
	// Prepare necessary users
	const users = await Promise.all([
		createUser(ctx, balenaOrg),
		createUser(ctx, balenaOrg),
		createUser(ctx, balenaOrg),
	]);

	// Create thread to post on
	const thread = await ctx.createContract(
		users[0].id,
		{ actor: users[0] },
		'thread@1.0.0',
		aTestUtils.generateRandomId(),
		{},
	);

	// Post as hubot user
	// Should not be included in thread-wide ping
	await ctx.createEvent(
		hubot.id,
		{ actor: hubot },
		thread,
		aTestUtils.generateRandomId(),
		'message',
	);

	// Post as first normal user
	// Should be included in thread-wide ping
	await ctx.createEvent(
		users[0].id,
		{ actor: users[0] },
		thread,
		`${users[2].slug.replace(/^user-/, '@')} ${aTestUtils.generateRandomId()}`,
		'message',
	);

	// Post thread-wide ping mention with second normal user
	// Should not be included in thread-wide ping
	const content = aTestUtils.generateRandomId();
	await ctx.createEvent(
		users[1].id,
		{ actor: users[1] },
		thread,
		`@t ${content}`,
		'message',
	);

	// Get matching message that should exist after triggered thread-wide ping update
	const mentions = [users[0].slug, users[2].slug]
		.map((slug) => {
			return slug.replace(/^user-/, '@');
		})
		.sort()
		.join(' ');
	const match = await ctx.waitForMatch({
		type: 'object',
		required: ['type', 'data'],
		properties: {
			type: {
				const: 'message@1.0.0',
			},
			data: {
				type: 'object',
				required: ['actor', 'payload'],
				properties: {
					actor: {
						const: users[1].id,
					},
					payload: {
						type: 'object',
						required: ['message'],
						properties: {
							message: {
								const: `${content} ${mentions}`,
							},
						},
					},
				},
			},
		},
	});
	const message: any = (match.data.payload as any).message;
	expect(message.startsWith('@t ')).toBe(false);
	expect(message.includes('@hubot')).toBe(false);
	expect(message.includes(users[1].slug.replace(/^user-/, '@'))).toBe(false);
	expect(message.includes(users[2].slug.replace(/^user-/, '@'))).toBe(true);
	expect(message.includes(content)).toBe(true);
});

test('sets thread-wide ping on @thread mention', async () => {
	// Prepare necessary users
	const users = await Promise.all([
		createUser(ctx, balenaOrg),
		createUser(ctx, balenaOrg),
		createUser(ctx, balenaOrg),
	]);

	// Create thread to post on
	const thread = await ctx.createContract(
		users[0].id,
		{ actor: users[0] },
		'thread@1.0.0',
		aTestUtils.generateRandomId().split('-')[0],
		{},
	);

	// Post as first normal user
	// Should be included in thread-wide ping
	await ctx.createEvent(
		users[0].id,
		{ actor: users[0] },
		thread,
		`${users[2].slug.replace(/^user-/, '@')} ${aTestUtils.generateRandomId()}`,
		'message',
	);

	// Post thread-wide ping mention with second normal user
	// Should not be included in thread-wide ping
	const content = aTestUtils.generateRandomId();
	await ctx.createEvent(
		users[1].id,
		{ actor: users[1] },
		thread,
		`${content} @thread`,
		'message',
	);

	// Get matching message that should exist after triggered thread-wide ping update
	const mentions = [users[0].slug, users[2].slug]
		.map((slug) => {
			return slug.replace(/^user-/, '@');
		})
		.sort()
		.join(' ');
	const match = await ctx.waitForMatch({
		type: 'object',
		required: ['type', 'data'],
		properties: {
			type: {
				const: 'message@1.0.0',
			},
			data: {
				type: 'object',
				required: ['actor', 'payload'],
				properties: {
					actor: {
						const: users[1].id,
					},
					payload: {
						type: 'object',
						required: ['message'],
						properties: {
							message: {
								const: `${content} ${mentions}`,
							},
						},
					},
				},
			},
		},
	});
	const message: any = (match.data.payload as any).message;
	expect(message.startsWith('@thread ')).toBe(false);
	expect(message.includes(users[1].slug.replace(/^user-/, '@'))).toBe(false);
	expect(message.includes(users[2].slug.replace(/^user-/, '@'))).toBe(true);
	expect(message.includes(content)).toBe(true);
});

test('sets thread-wide ping on @people mention', async () => {
	// Prepare necessary users
	const users = await Promise.all([
		createUser(ctx, balenaOrg),
		createUser(ctx, balenaOrg),
		createUser(ctx, balenaOrg),
	]);

	// Create thread to post on
	const thread = await ctx.createContract(
		users[0].id,
		{ actor: users[0] },
		'thread@1.0.0',
		aTestUtils.generateRandomId().split('-')[0],
		{},
	);

	// Post as first normal user
	// Should be included in thread-wide ping
	await ctx.createEvent(
		users[0].id,
		{ actor: users[0] },
		thread,
		`${users[2].slug.replace(/^user-/, '@')} ${aTestUtils.generateRandomId()}`,
		'message',
	);

	// Post thread-wide ping mention with second normal user
	// Should not be included in thread-wide ping
	const content = aTestUtils.generateRandomId();
	await ctx.createEvent(
		users[1].id,
		{ actor: users[1] },
		thread,
		`${content} @people`,
		'whisper',
	);

	// Get matching message that should exist after triggered thread-wide ping update
	const mentions = [users[0].slug, users[2].slug]
		.map((slug) => {
			return slug.replace(/^user-/, '@');
		})
		.sort()
		.join(' ');
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
						const: users[1].id,
					},
					payload: {
						type: 'object',
						required: ['message'],
						properties: {
							message: {
								const: `${content} ${mentions}`,
							},
						},
					},
				},
			},
		},
	});
	const message: any = (match.data.payload as any).message;
	expect(message.startsWith('@thread ')).toBe(false);
	expect(message.includes(users[1].slug.replace(/^user-/, '@'))).toBe(false);
	expect(message.includes(users[2].slug.replace(/^user-/, '@'))).toBe(true);
	expect(message.includes(content)).toBe(true);
});

test('thread-wide pings only include balena users', async () => {
	// Prepare necessary users
	const users = await Promise.all([
		createUser(ctx, balenaOrg),
		createUser(ctx, balenaOrg),
		ctx.createUser(aTestUtils.generateRandomId().split('-')[0]),
		ctx.createUser(aTestUtils.generateRandomId().split('-')[0]),
	]);

	// Create thread to post on
	const thread = await ctx.createContract(
		users[0].id,
		{ actor: users[0] },
		'thread@1.0.0',
		aTestUtils.generateRandomId().split('-')[0],
		{},
	);

	// Post as first normal user, mentioning external user
	// Should be the only user included in thread-wide ping
	await ctx.createEvent(
		users[0].id,
		{ actor: users[0] },
		thread,
		`${users[2].slug.replace(/^user-/, '@')} ${aTestUtils.generateRandomId()}`,
		'message',
	);

	// Post as other external user
	// Should not be included in thread-wide ping
	await ctx.createEvent(
		users[3].id,
		{ actor: users[3] },
		thread,
		aTestUtils.generateRandomId(),
		'message',
	);

	// Post thread-wide ping mention with second normal user
	// Should not be included in thread-wide ping
	const content = aTestUtils.generateRandomId();
	await ctx.createEvent(
		users[1].id,
		{ actor: users[1] },
		thread,
		`${content} @people`,
		'whisper',
	);

	// Get matching whisper that should exist after triggered thread-wide ping update
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
						const: users[1].id,
					},
					payload: {
						type: 'object',
						required: ['message'],
						properties: {
							message: {
								const: `${content} ${users[0].slug.replace(/^user-/, '@')}`,
							},
						},
					},
				},
			},
		},
	});
});
