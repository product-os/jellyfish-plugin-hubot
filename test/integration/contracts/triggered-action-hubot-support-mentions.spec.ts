import { testUtils as wTestUtils } from '@balena/jellyfish-worker';
import { strict as assert } from 'assert';
import { testUtils as aTestUtils } from 'autumndb';
import * as moment from 'moment';
import * as sinon from 'sinon';
import { hubotPlugin } from '../../../lib';
import * as utils from '../../../lib/actions/utils';

let ctx: wTestUtils.TestContext;

beforeAll(async () => {
	ctx = await wTestUtils.newContext({
		plugins: [hubotPlugin()],
	});
});

afterAll(() => {
	sinon.restore();
	return wTestUtils.destroyContext(ctx);
});

function stub(items: any[]): void {
	sinon.stub(utils, 'fetchCalendarEvents').callsFake(async () => {
		return items;
	});
}

test('Should ping those on support', async () => {
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

	// Mock response to simulate users with support shifts
	const items = ['foo', 'bar', 'buz'].map((name) => {
		return {
			summary: `@${name} on support`,
			start: {
				dateTime:
					name === 'buz'
						? moment().add(1, 'hours').format()
						: moment().subtract(1, 'hours').format(),
			},
			end: {
				dateTime:
					name === 'buz'
						? moment().add(3, 'hours').format()
						: moment().add(1, 'hours').format(),
			},
			attendees: [
				{
					email: `${name}@balena.io`,
				},
			],
		};
	});
	stub(items);

	// Ping support-now with users on support
	const thread = await ctx.createContract(
		userBaz.id,
		{ actor: userBaz },
		'thread@1.0.0',
		aTestUtils.generateRandomId(),
		{},
	);
	let ping = await ctx.createEvent(
		userBaz.id,
		{ actor: userBaz },
		thread,
		'@support-now test',
		'message',
	);
	let match = await ctx.waitForMatch({
		type: 'object',
		required: ['id', 'data'],
		properties: {
			id: {
				const: ping.id,
			},
			data: {
				type: 'object',
				required: ['payload'],
				properties: {
					payload: {
						type: 'object',
						required: ['message'],
						properties: {
							message: {
								pattern: 'foo',
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
	let message = (match.data.payload as any).message;
	expect(message.includes('test')).toBe(true);
	expect(message.includes('@foo')).toBe(true);
	expect(message.includes('@bar')).toBe(true);
	expect(message.includes('@buz')).toBe(false);
	expect(message.includes('@support-now')).toBe(false);

	ping = await ctx.createEvent(
		userBaz.id,
		{ actor: userBaz },
		thread,
		'@support-today test',
		'message',
	);
	match = await ctx.waitForMatch({
		type: 'object',
		required: ['id', 'data'],
		properties: {
			id: {
				const: ping.id,
			},
			data: {
				type: 'object',
				required: ['payload'],
				properties: {
					payload: {
						type: 'object',
						required: ['message'],
						properties: {
							message: {
								pattern: 'buz',
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
	message = (match.data.payload as any).message;
	expect(message.includes('test')).toBe(true);
	expect(message.includes('@buz')).toBe(true);
	expect(message.includes('@foo')).toBe(true);
	expect(message.includes('@bar')).toBe(true);
	expect(message.includes('@support-now')).toBe(false);
});
