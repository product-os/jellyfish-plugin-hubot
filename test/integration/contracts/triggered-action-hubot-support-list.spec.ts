import { defaultEnvironment } from '@balena/jellyfish-environment';
import { testUtils as wTestUtils } from '@balena/jellyfish-worker';
import { strict as assert } from 'assert';
import { testUtils as aTestUtils } from 'autumndb';
import * as moment from 'moment';
import * as nock from 'nock';
import { hubotPlugin } from '../../../lib';

let ctx: wTestUtils.TestContext;
const env = defaultEnvironment.hubot.support;

beforeAll(async () => {
	ctx = await wTestUtils.newContext({
		plugins: [hubotPlugin()],
	});
});

afterAll(() => {
	nock.cleanAll();
	return wTestUtils.destroyContext(ctx);
});

test('Should returns expected list of users on support', async () => {
	nock('https://www.googleapis.com')
		.persist()
		.post('/oauth2/v4/token')
		.reply(200, {});

	// Prepare necessary contracts
	const [hubot, balenaOrg, userFoo, userBar, userBuz, userBaz] =
		await Promise.all([
			ctx.kernel.getContractBySlug(
				ctx.logContext,
				ctx.session,
				'user-hubot@latest',
			),
			ctx.kernel.getContractBySlug(
				ctx.logContext,
				ctx.session,
				'org-balena@latest',
			),
			ctx.createUser('foo'),
			ctx.createUser('bar'),
			ctx.createUser('buz'),
			ctx.createUser('baz'),
		]);
	assert(hubot, 'hubot user not found');
	assert(balenaOrg, 'org-balena not found');
	await Promise.all([
		ctx.createLink(balenaOrg, userFoo, 'has member', 'is member of'),
		ctx.createLink(balenaOrg, userBar, 'has member', 'is member of'),
		ctx.createLink(balenaOrg, userBuz, 'has member', 'is member of'),
		ctx.createLink(balenaOrg, userBaz, 'has member', 'is member of'),
	]);
	await Promise.all(
		['foo', 'bar', 'buz'].map(async (name) => {
			await ctx.kernel.patchContractBySlug(
				ctx.logContext,
				ctx.session,
				`user-${name}@1.0.0`,
				[
					{
						op: 'replace',
						path: '/data/email',
						value: `${name}@balena.io`,
					},
				],
			);
		}),
	);

	// Nock Google API
	nock('https://www.googleapis.com')
		.get(`/calendar/v3/calendars/${env.calendar}/events`)
		.query(true)
		.reply(200, []);

	// Request list of users currently on support
	const thread = await ctx.createContract(
		userBaz.id,
		{ actor: userBaz },
		'thread@1.0.0',
		aTestUtils.generateRandomId(),
		{},
	);
	await ctx.createEvent(
		userBaz.id,
		{ actor: userBaz },
		thread,
		'@hubot whos on support?',
		'message',
	);

	// Assert that the hubot whisper was created
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
								const: 'No one is on support at the moment',
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

	// Mock response to simulate users with support shifts
	nock('https://www.googleapis.com')
		.persist()
		.get(`/calendar/v3/calendars/${env.calendar}/events`)
		.query(true)
		.reply(200, {
			kind: 'calendar#events',
			items: ['foo', 'bar', 'buz'].map((name) => {
				return {
					summary: `${name} on support`,
					start: {
						dateTime:
							name === 'buz'
								? moment().add(1, 'days').format()
								: moment().subtract(1, 'hours').format(),
					},
					end: {
						dateTime:
							name === 'buz'
								? moment().add(1, 'days').add(1, 'hours').format()
								: moment().add(1, 'hours').format(),
					},
					attendees: [
						{
							email: `${name}@balena.io`,
						},
					],
				};
			}),
		});

	// Request list of users currently on support
	await ctx.createEvent(
		userBaz.id,
		{ actor: userBaz },
		thread,
		'@hubot whos on support?',
		'message',
	);
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
								pattern: 'ending in an hour',
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
	const message = (match.data.payload as any).message;
	expect(message.includes('foo on support, ending in an hour.')).toBe(true);
	expect(message.includes('bar on support, ending in an hour.')).toBe(true);

	// Check that tomorrow queries return the expected response
	await ctx.createEvent(
		userBaz.id,
		{ actor: userBaz },
		thread,
		'@hubot whos on support tomorrow?',
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
								const: 'buz on support, starting in a day.',
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
