import { testUtils as workerTestUtils } from '@balena/jellyfish-worker';
import { strict as assert } from 'assert';
import type { OrgContract, UserContract } from 'autumndb';
import { setTimeout as delay } from 'timers/promises';
import { v4 as uuid } from 'uuid';
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

async function createUser(org: OrgContract): Promise<UserContract> {
	const user = await ctx.createUser(uuid().split('-')[0]);
	await ctx.createLink(org, user, 'has member', 'is member of');
	return user;
}

test('Sets thread-wide ping on @t mention', async () => {
	// Prepare necessary users
	const org = await ctx.kernel.getContractBySlug(
		ctx.logContext,
		ctx.session,
		'org-balena@1.0.0',
	);
	assert(org, 'org-balena not found');
	const users = await Promise.all([
		createUser(org),
		createUser(org),
		createUser(org),
	]);
	const hubot = await ctx.kernel.getContractBySlug(
		ctx.logContext,
		ctx.session,
		'user-hubot@latest',
	);
	assert(hubot, 'Hubot user not found');

	// Create thread to post on
	const thread = await ctx.createContract(
		users[0].id,
		{ actor: users[0] },
		'thread@1.0.0',
		uuid().split('-')[0],
		{},
	);

	// Post as hubot user
	// Should not be included in thread-wide ping
	await ctx.createEvent(hubot.id, { actor: hubot }, thread, uuid(), 'message');

	// Post as first normal user
	// Should be included in thread-wide ping
	await ctx.createEvent(
		users[0].id,
		{ actor: users[0] },
		thread,
		`${users[2].slug.replace(/^user-/, '@')} ${uuid()}`,
		'message',
	);

	// Post thread-wide ping mention with second normal user
	// Should not be included in thread-wide ping
	const content = uuid();
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
}, 10000);

test('Sets thread-wide ping on @thread mention', async () => {
	// Prepare necessary users
	const org = await ctx.kernel.getContractBySlug(
		ctx.logContext,
		ctx.session,
		'org-balena@1.0.0',
	);
	assert(org, 'org-balena not found');
	const users = await Promise.all([
		createUser(org),
		createUser(org),
		createUser(org),
	]);

	// Create thread to post on
	const thread = await ctx.createContract(
		users[0].id,
		{ actor: users[0] },
		'thread@1.0.0',
		uuid().split('-')[0],
		{},
	);

	// Post as first normal user
	// Should be included in thread-wide ping
	await ctx.createEvent(
		users[0].id,
		{ actor: users[0] },
		thread,
		`${users[2].slug.replace(/^user-/, '@')} ${uuid()}`,
		'message',
	);

	// Post thread-wide ping mention with second normal user
	// Should not be included in thread-wide ping
	const content = uuid();
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
}, 10000);

test('Sets thread-wide ping on @people mention', async () => {
	// Prepare necessary users
	const org = await ctx.kernel.getContractBySlug(
		ctx.logContext,
		ctx.session,
		'org-balena@1.0.0',
	);
	assert(org, 'org-balena not found');
	const users = await Promise.all([
		createUser(org),
		createUser(org),
		createUser(org),
	]);

	// Create thread to post on
	const thread = await ctx.createContract(
		users[0].id,
		{ actor: users[0] },
		'thread@1.0.0',
		uuid().split('-')[0],
		{},
	);

	// Post as first normal user
	// Should be included in thread-wide ping
	await ctx.createEvent(
		users[0].id,
		{ actor: users[0] },
		thread,
		`${users[2].slug.replace(/^user-/, '@')} ${uuid()}`,
		'message',
	);

	// Post thread-wide ping mention with second normal user
	// Should not be included in thread-wide ping
	const content = uuid();
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
}, 10000);

test('Ignores thread-wide pings from non-balena users', async () => {
	// Prepare necessary users
	const org = await ctx.createOrg(uuid().split('-')[0]);
	const users = await Promise.all([
		createUser(org),
		createUser(org),
		createUser(org),
	]);

	// Create thread to post on
	const thread = await ctx.createContract(
		users[0].id,
		{ actor: users[0] },
		'thread@1.0.0',
		uuid().split('-')[0],
		{},
	);

	// Post as first normal user
	await ctx.createEvent(
		users[0].id,
		{ actor: users[0] },
		thread,
		`${users[2].slug.replace(/^user-/, '@')} ${uuid()}`,
		'message',
	);

	// Post thread-wide ping mention with second normal user
	const content = uuid();
	const message = await ctx.createEvent(
		users[1].id,
		{ actor: users[1] },
		thread,
		`${content} @people`,
		'message',
	);

	// Wait a few seconds to allow worker to process triggered actions
	await delay(3000);

	// Assert that the message hasn't been updated
	const latest = await ctx.kernel.getContractById(
		ctx.logContext,
		ctx.session,
		message.id,
	);
	assert(latest, `Failed to get message: ${message.id}`);
	expect((latest.data.payload as any).message).toEqual(
		(message.data.payload as any).message,
	);
}, 10000);

test('Thread-wide pings only include balena users', async () => {
	// Prepare necessary users
	const org = await ctx.kernel.getContractBySlug(
		ctx.logContext,
		ctx.session,
		'org-balena@1.0.0',
	);
	assert(org, 'org-balena not found');
	const users = await Promise.all([
		createUser(org),
		createUser(org),
		ctx.createUser(uuid().split('-')[0]),
	]);

	// Create thread to post on
	const thread = await ctx.createContract(
		users[0].id,
		{ actor: users[0] },
		'thread@1.0.0',
		uuid().split('-')[0],
		{},
	);

	// Post as first normal user
	// Should be the only user included in thread-wide ping
	await ctx.createEvent(
		users[0].id,
		{ actor: users[0] },
		thread,
		`${users[2].slug.replace(/^user-/, '@')} ${uuid()}`,
		'message',
	);

	// Post thread-wide ping mention with second normal user
	// Should not be included in thread-wide ping
	const content = uuid();
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
}, 10000);
