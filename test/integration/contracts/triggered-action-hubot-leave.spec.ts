import { defaultEnvironment } from '@balena/jellyfish-environment';
import { testUtils as wTestUtils } from '@balena/jellyfish-worker';
import { strict as assert } from 'assert';
import { testUtils as aTestUtils } from 'autumndb';
import * as nock from 'nock';
import { createUser } from './utils';
import { hubotPlugin } from '../../../lib';

let ctx: wTestUtils.TestContext;
const env = defaultEnvironment.hubot.leave;

beforeAll(async () => {
	ctx = await wTestUtils.newContext({
		plugins: [hubotPlugin()],
	});
});

afterEach(() => {
	nock.cleanAll();
});

afterAll(() => {
	return wTestUtils.destroyContext(ctx);
});

function nockCalamari(today: string, leave?: any) {
	nock.cleanAll();
	nock(`https://${env.calamari.instance}.calamari.io`)
		.persist()
		.post('/api/leave/request/v1/find')
		.reply(
			200,
			leave
				? leave
				: [
						{
							id: 1234,
							from: today,
							to: today,
							absenceTypeName: 'Leave',
							absenceTypeId: 13,
							absenceCategory: 'TIMEOFF',
							status: 'ACCEPTED',
							entitlementAmount: 8,
							reason: null,
							amountFirstDay: null,
							amountLastDay: null,
							entitlementAmountUnit: 'DAYS',
							created: '2022-08-09T01:32:43+0000',
							updated: '2022-08-09T01:32:43+0000',
							fullDayRequest: true,
							startTime: `${today}T00:00:00`,
							endTime: `${today}T23:59:59`,
							timeZone: 'UTC',
						},
				  ],
		);
}

test('responds when people are on leave', async () => {
	// Prepare necessary users
	const [hubot, balenaOrg] = await Promise.all([
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
	]);
	assert(hubot, 'user-hubot not found');
	assert(balenaOrg, 'org-balena not found');
	const userFoo = await createUser(ctx, balenaOrg);
	await ctx.kernel.patchContractBySlug(
		ctx.logContext,
		ctx.session,
		`${userFoo.slug}@1.0.0`,
		[
			{
				op: 'replace',
				path: '/data/email',
				value: `${userFoo.slug.replace(/^user-/, '')}@balena.io`,
			},
		],
	);

	// Create thread to post on
	const thread = await ctx.createContract(
		userFoo.id,
		{ actor: userFoo },
		'thread@1.0.0',
		aTestUtils.generateRandomId(),
		{},
	);

	// Test when no one is on leave
	nockCalamari(new Date().toISOString().split('T')[0], []);
	await ctx.createEvent(
		userFoo.id,
		{ actor: userFoo },
		thread,
		'@hubot whos off today?',
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
								const: 'No one is on leave.',
							},
						},
					},
				},
			},
		},
	});

	// Test when people are on leave
	const userBar = await createUser(ctx, balenaOrg);
	await ctx.kernel.patchContractBySlug(
		ctx.logContext,
		ctx.session,
		`${userBar.slug}@1.0.0`,
		[
			{
				op: 'replace',
				path: '/data/email',
				value: `${userBar.slug.replace(/^user-/, '')}@balena.io`,
			},
		],
	);
	nockCalamari(new Date().toISOString().split('T')[0]);
	await ctx.createEvent(
		userFoo.id,
		{ actor: userFoo },
		thread,
		'@hubot whos off today?',
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
								pattern: 'is on leave, returning to work',
							},
						},
					},
				},
			},
		},
	});
	const message = (match.data.payload as any).message;
	expect(
		message.includes(
			`${userBar.slug.replace(/^user-/, '')} is on leave, returning to work`,
		),
	).toBe(true);

	// Test pinging a user who is on leave
	await ctx.createEvent(
		userFoo.id,
		{ actor: userFoo },
		thread,
		`@${userBar.slug.replace(/^user-/, '')} test`,
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
								pattern: `${userBar.slug.replace(
									/^user-/,
									'',
								)} is on leave today, returning to work`,
							},
						},
					},
				},
			},
		},
	});
});
