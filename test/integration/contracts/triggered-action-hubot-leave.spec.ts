import { defaultEnvironment } from '@balena/jellyfish-environment';
import { testUtils as wTestUtils } from '@balena/jellyfish-worker';
import { strict as assert } from 'assert';
import { testUtils as aTestUtils } from 'autumndb';
import * as nock from 'nock';
import { setTimeout as delay } from 'timers/promises';
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

afterEach(() => {
	nock.cleanAll();
});

afterAll(() => {
	return wTestUtils.destroyContext(ctx);
});

function nockCalamari(today: string, leave?: any) {
	nock(
		`https://${defaultEnvironment.hubot.leave.calamari.instance}.calamari.io`,
	)
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

test('returns list of people on leave', async () => {
	nockCalamari(new Date().toISOString().split('T')[0]);

	// Prepare necessary users
	const users = await Promise.all([
		createUser(ctx, balenaOrg),
		createUser(ctx, balenaOrg),
	]);
	await Promise.all(
		users.map(async (user) => {
			await ctx.kernel.patchContractBySlug(
				ctx.logContext,
				ctx.session,
				`${user.slug}@1.0.0`,
				[
					{
						op: 'replace',
						path: '/data/email',
						value: `${user.slug.replace(/^user-/, '')}@balena.io`,
					},
				],
			);
		}),
	);

	// Create thread to post on
	const thread = await ctx.createContract(
		users[0].id,
		{ actor: users[0] },
		'thread@1.0.0',
		aTestUtils.generateRandomId(),
		{},
	);

	// Ask hubot whos on leave today
	await ctx.createEvent(
		users[0].id,
		{ actor: users[0] },
		thread,
		'@hubot whos off today?',
		'message',
	);

	// Assert the expected users are included in the response
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
								pattern: 'is on leave, returning to work tomorrow',
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
			`${users[0].slug.replace(
				/^user-/,
				'',
			)} is on leave, returning to work tomorrow`,
		),
	).toBe(true);
	expect(
		message.includes(
			`${users[1].slug.replace(
				/^user-/,
				'',
			)} is on leave, returning to work tomorrow`,
		),
	).toBe(true);
});

test('responds when mentioned user is on leave', async () => {
	nockCalamari(new Date().toISOString().split('T')[0]);

	// Prepare necessary users, all of which will be on leave defined above
	const users = await Promise.all([
		createUser(ctx, balenaOrg),
		createUser(ctx, balenaOrg),
		createUser(ctx, balenaOrg),
	]);
	await Promise.all(
		users.map(async (user) => {
			await ctx.kernel.patchContractBySlug(
				ctx.logContext,
				ctx.session,
				`${user.slug}@1.0.0`,
				[
					{
						op: 'replace',
						path: '/data/email',
						value: `${user.slug.replace(/^user-/, '')}@balena.io`,
					},
				],
			);
		}),
	);

	// Ping two users who are on leave
	const thread = await ctx.createContract(
		users[0].id,
		{ actor: users[0] },
		'thread@1.0.0',
		aTestUtils.generateRandomId(),
		{},
	);
	await ctx.createEvent(
		users[0].id,
		{ actor: users[0] },
		thread,
		`@${users[1].slug.replace(/^user-/, '')} @${users[2].slug.replace(
			/^user-/,
			'',
		)} test`,
		'message',
	);

	// Assert that hubot whispers that both users are on leave
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
								pattern: `${users[1].slug.replace(
									/^user-/,
									'',
								)} is on leave today, returning to work tomorrow`,
							},
						},
					},
				},
			},
		},
	});
	expect(
		(match.data.payload as any).message.includes(
			`${users[2].slug.replace(
				/^user-/,
				'',
			)} is on leave today, returning to work tomorrow`,
		),
	).toBe(true);
});

test('ignores requests from non-balena users', async () => {
	nockCalamari(new Date().toISOString().split('T')[0]);

	// Prepare one balena user and another external user
	// The balena user will be on leave, the external users request should be ignored
	const org = await ctx.createOrg(aTestUtils.generateRandomId().split('-')[0]);
	const users = await Promise.all([
		createUser(ctx, balenaOrg),
		createUser(ctx, org),
	]);
	await ctx.kernel.patchContractBySlug(
		ctx.logContext,
		ctx.session,
		`${users[0].slug}@1.0.0`,
		[
			{
				op: 'replace',
				path: '/data/email',
				value: `${users[0].slug.replace(/^user-/, '')}@balena.io`,
			},
		],
	);

	// Ask hubot whos on leave today
	const thread = await ctx.createContract(
		users[0].id,
		{ actor: users[0] },
		'thread@1.0.0',
		aTestUtils.generateRandomId(),
		{},
	);
	await ctx.createEvent(
		users[1].id,
		{ actor: users[1] },
		thread,
		'@hubot whos off today?',
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
									pattern: `${users[0].slug.replace(
										/^user-/,
										'',
									)} is on leave today, returning to work tomorrow`,
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
