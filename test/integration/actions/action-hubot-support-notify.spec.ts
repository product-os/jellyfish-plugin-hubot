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

test('Should send support handover message', async () => {
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
	const user = ctx.session.actor;
	await Promise.all([
		ctx.createLink(balenaOrg, user, 'has member', 'is member of'),
		ctx.createLink(balenaOrg, userFoo, 'has member', 'is member of'),
		ctx.createLink(balenaOrg, userBar, 'has member', 'is member of'),
		ctx.createLink(balenaOrg, userBuz, 'has member', 'is member of'),
		ctx.createLink(balenaOrg, userBaz, 'has member', 'is member of'),
	]);
	await Promise.all(
		['foo', 'bar', 'buz', 'baz'].map(async (name) => {
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

	const thread = await ctx.createContract(
		user.id,
		{ actor: user },
		'thread@1.0.0',
		aTestUtils.generateRandomId(),
		{},
	);

	// Mock response to simulate users with support shifts
	nock('https://www.googleapis.com')
		.persist()
		.get(`/calendar/v3/calendars/${env.calendar}/events`)
		.query(true)
		.reply(200, {
			kind: 'calendar#events',
			items: ['foo', 'bar', 'buz', 'baz'].map((name) => {
				return {
					summary: `${name} on support`,
					start: {
						dateTime:
							name === 'bar' || name === 'baz'
								? moment().add(5, 'minutes').format()
								: moment().subtract(55, 'minutes').format(),
					},
					end: {
						dateTime:
							name === 'bar' || name === 'baz'
								? moment().add(1, 'hours').add(5, 'minutes').format()
								: moment().add(5, 'minutes').format(),
					},
					attendees: [
						{
							email: `${name}@balena.io`,
						},
					],
				};
			}),
		});

	// Assert the expected handover message is created by hubot
	const now = new Date();
	const actionRequestType = ctx.worker.typeContracts['action-request@1.0.0'];
	await ctx.worker.insertCard(
		ctx.logContext,
		ctx.session,
		actionRequestType,
		{
			timestamp: now.toISOString(),
			actor: ctx.adminUserId,
		},
		{
			data: {
				card: actionRequestType.id,
				action: 'action-hubot-support-notify@1.0.0',
				actor: ctx.adminUserId,
				context: ctx.logContext,
				input: {
					id: actionRequestType.id,
				},
				epoch: now.valueOf(),
				timestamp: now.toISOString(),
				arguments: {
					thread: thread.id,
				},
			},
		},
	);
	await ctx.flushAll(ctx.session);

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
								pattern: env.end.instructions,
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
	expect(message.includes(env.start.instructions)).toBe(true);

	expect(message.includes('Nearing the end for foo on support')).toBe(true);
	expect(message.includes('Nearing the end for buz on support')).toBe(true);
	expect(message.includes('Nearing the end for bar on support')).toBe(false);
	expect(message.includes('Nearing the end for baz on support')).toBe(false);

	expect(
		message.includes(
			'bar on support: your shift starts in 5 minutes for an hour - Please ack',
		),
	).toBe(true);
	expect(
		message.includes(
			'baz on support: your shift starts in 5 minutes for an hour - Please ack',
		),
	).toBe(true);
	expect(
		message.includes(
			'foo on support: your shift starts in 5 minutes for an hour - Please ack',
		),
	).toBe(false);
	expect(
		message.includes(
			'buz on support: your shift starts in 5 minutes for an hour - Please ack',
		),
	).toBe(false);
});
