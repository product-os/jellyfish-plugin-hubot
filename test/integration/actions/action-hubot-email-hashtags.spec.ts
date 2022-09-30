import { defaultEnvironment } from '@balena/jellyfish-environment';
import { testUtils as wTestUtils } from '@balena/jellyfish-worker';
import { strict as assert } from 'assert';
import * as nodemailer from 'nodemailer';
import * as nodemailerMock from 'nodemailer-mock';
import { sendEmail } from '../../../lib/actions/action-hubot-email-hashtags';

let ctx: wTestUtils.TestContext;
const smtpServer = defaultEnvironment.hubot.emailHashtags.smtp.server;
const smtpUser = encodeURIComponent(
	defaultEnvironment.hubot.emailHashtags.smtp.user,
);
const smtpPassword = defaultEnvironment.hubot.emailHashtags.smtp.password;

beforeAll(async () => {
	ctx = await wTestUtils.newContext();
});

afterAll(() => {
	return wTestUtils.destroyContext(ctx);
});

test('Sends expected emails', async () => {
	const mocked = nodemailerMock.getMockFor(nodemailer);
	const transporter = mocked.createTransport(
		`smtps://${smtpUser}:${smtpPassword}@${smtpServer}`,
	);

	const user = await ctx.createUser('foobar');
	const hubot = await ctx.kernel.getContractBySlug(
		ctx.logContext,
		ctx.session,
		'user-hubot@latest',
	);
	assert(hubot, 'Hubot user not found');

	const thread = await ctx.createContract(
		user.id,
		{ actor: user },
		'thread@1.0.0',
		'foobar',
		{},
	);
	assert(thread, 'Failed to create thread');

	const source = `https://jel.ly.fish/${thread.id}`;
	const message = '@@operations I need #access to this thing';
	const results = await sendEmail(
		ctx.logContext,
		message,
		user,
		source,
		transporter,
	);
	const sent = mocked.mock.getSentMail();
	expect(sent[0].from).toEqual('"Hubot" <hubot@resin.io>');
	expect(sent[0].to).toEqual(
		`access@${defaultEnvironment.hubot.emailHashtags.domain}`,
	);
	expect(sent[0].subject).toEqual(
		`#${results[0].id} - ${message.replace('#', '')}`,
	);
	expect(sent[0].text.includes(message.replace('#', ''))).toBe(true);
	expect(sent[0].text.includes(`Thread: ${source}`)).toBe(true);
	expect(sent[0].text.includes('Hashtags: access')).toBe(true);
	expect(sent[0].text.includes(`Reporter: ${user.slug}`)).toBe(true);
	expect(sent[0].text.includes('Mentions: @@operations')).toBe(true);
});

test('Sends multiple emails', async () => {
	const mocked = nodemailerMock.getMockFor(nodemailer);
	const transporter = mocked.createTransport(
		`smtps://${smtpUser}:${smtpPassword}@${smtpServer}`,
	);

	const user = await ctx.createUser('foobar');
	const hubot = await ctx.kernel.getContractBySlug(
		ctx.logContext,
		ctx.session,
		'user-hubot@latest',
	);
	assert(hubot, 'Hubot user not found');

	const thread = await ctx.createContract(
		user.id,
		{ actor: user },
		'thread@1.0.0',
		'foobar',
		{},
	);
	assert(thread, 'Failed to create thread');

	const source = `https://jel.ly.fish/${thread.id}`;
	const message = '@@operations I need #access to this thing for #order';
	await sendEmail(ctx.logContext, message, user, source, transporter);
	const sent = mocked.mock.getSentMail();
	expect(sent.length).toEqual(2);
	expect(sent[0].to).toEqual(
		`access@${defaultEnvironment.hubot.emailHashtags.domain}`,
	);
	expect(sent[1].to).toEqual(
		`order@${defaultEnvironment.hubot.emailHashtags.domain}`,
	);
	expect(sent[0].text.includes('Hashtags: access, order')).toBe(true);
	expect(sent[1].text.includes('Hashtags: access, order')).toBe(true);
});
