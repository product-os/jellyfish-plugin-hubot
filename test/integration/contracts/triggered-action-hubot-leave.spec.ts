import { testUtils as wTestUtils } from '@balena/jellyfish-worker';
import { strict as assert } from 'assert';
import { testUtils as aTestUtils } from 'autumndb';
import * as sinon from 'sinon';
import { createUser } from './utils';
import { hubotPlugin } from '../../../lib';
import { Calamari, Leave } from '../../../lib/calamari';

let ctx: wTestUtils.TestContext;

beforeAll(async () => {
	ctx = await wTestUtils.newContext({
		plugins: [hubotPlugin()],
	});
});

afterEach(() => {
	sinon.restore();
});

afterAll(() => {
	return wTestUtils.destroyContext(ctx);
});

function stub(emails: string[]) {
	sinon.restore();

	const today = new Date().toISOString().split('T')[0];
	sinon.stub(Calamari.prototype, 'getLeaveFromCalamari').callsFake(async () => {
		const leaves: Leave[] = [];
		for (const email of emails) {
			leaves.push({
				email,
				from: today,
				to: today,
				status: 'ACCEPTED',
				firstDayHalf: false,
				lastDayHalf: false,
			});
		}
		return leaves;
	});
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
	stub([]);
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
	stub([`${userBar.slug.replace(/^user-/, '')}@balena.io`]);
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
