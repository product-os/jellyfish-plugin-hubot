import { defaultEnvironment } from '@balena/jellyfish-environment';
import { getLogger, LogContext } from '@balena/jellyfish-logger';
import type { ActionDefinition } from '@balena/jellyfish-worker';
import { strict as assert } from 'assert';
import * as retry from 'async-retry';
import type { TypeContract, UserContract } from 'autumndb';
import * as _ from 'lodash';
import * as moment from 'moment';
import * as nodemailer from 'nodemailer';
import { v4 as uuid } from 'uuid';

const logger = getLogger(__filename);
const emailLookup = JSON.parse(defaultEnvironment.hubot.emailHashtags.hashtags);
const domain = defaultEnvironment.hubot.emailHashtags.domain;
const smtpServer = defaultEnvironment.hubot.emailHashtags.smtp.server;
const smtpUser = encodeURIComponent(
	defaultEnvironment.hubot.emailHashtags.smtp.user,
);
const smtpPassword = defaultEnvironment.hubot.emailHashtags.smtp.password;

interface SendEmailResult {
	id: string;
	to: string[];
}

export async function sendEmail(
	logContext: LogContext,
	message: string,
	user: UserContract,
	source: string,
	transporter: nodemailer.Transporter = nodemailer.createTransport(
		`smtps://${smtpUser}:${smtpPassword}@${smtpServer}`,
	),
): Promise<SendEmailResult[]> {
	// Get hashtags from the message
	const hashtags = message.match(/\#[a-z-]+/g)?.map((match) => {
		return match.replace(/^#/, '');
	});

	// All the emails should have the same time, even if the ticks happen in different minutes
	const mailTime = moment().format('lll');

	// Create an array of unique email addresses
	const destinationEmails = _.uniq(
		_.map(hashtags, (hashtag) => {
			if (emailLookup[hashtag]) {
				return emailLookup[hashtag];
			}
		}),
	);

	// Go asynchronously round the matches
	const results: SendEmailResult[] = [];
	for (const destinationEmail of destinationEmails) {
		// Build the message text, adding extra useful information
		let messageText = message.trim();
		const footer = hashtags?.includes('order')
			? defaultEnvironment.hubot.emailHashtags.orderHashtagFooter
			: '';
		const mentionsMatch = messageText.match(/[@]?@[\w_-]+/g);
		const mentions = mentionsMatch ? mentionsMatch : [];
		messageText = `
${messageText}


========
Thread: ${source}
Hashtags: ${hashtags?.join(', ')}
Date: ${mailTime}
Reporter: ${user.slug}
Mentions: ${mentions.join(', ')}
========
${footer}
`;

		// Identify emails with a partial UUID
		const id = uuid().split('-')[1];

		// Send email to team member, using message first line as subject
		const mailSubject = messageText
			.trim()
			.split(/[\r\n]+/)[0]
			.trim();
		const mailData = {
			from: '"Hubot" <hubot@resin.io>',
			to: `${destinationEmail}@${domain}`,
			subject: `#${id} - ${mailSubject.replace(/#/g, '')}`,
			text: messageText.replace(/#/g, ''),
		};

		// Send the email, resolving or rejecting as appropriate
		const res = await retry(
			async () => {
				return transporter.sendMail(mailData);
			},
			{
				retries: 9,
				factor: 3,
				minTimeout: 4 * 1000,
				maxTimeout: 3 * 60 * 1000,
				randomize: true,
				onRetry: (error) => {
					logger.error(logContext, 'Attempt to send email failed:', {
						error,
					});
				},
			},
		);
		results.push({
			id,
			to: res.accepted as string[],
		});
	}

	return results;
}

const handler: ActionDefinition['handler'] = async (
	session,
	context,
	contract,
	request,
) => {
	const results = {
		id: contract.id,
		type: contract.type,
		version: contract.version,
		slug: contract.slug,
	};

	// Make sure a supported tag was found in the message
	let tag = '';
	for (const hashtag of Object.keys(emailLookup)) {
		if ((contract.data.payload as any).message.includes(`#${hashtag} `)) {
			tag = hashtag;
			break;
		}
	}
	if (_.isEmpty(tag)) {
		// No matching tags found in message, return early
		return results;
	}

	// Get required contracts
	const [actionRequest, hubot, user] = await Promise.all([
		context.getCardBySlug(context.privilegedSession, 'action-request@1.0.0'),
		context.getCardBySlug(context.privilegedSession, 'user-hubot@1.0.0'),
		context.getCardById(
			context.privilegedSession,
			contract.data.actor as string,
		),
	]);
	assert(actionRequest, 'action-request type not found');
	assert(hubot, 'user-hubot not found');
	assert(user, `user not found: ${contract.data.string}`);

	// Send email
	const sendEmailResults = await sendEmail(
		request.logContext,
		(contract.data.payload as any).message,
		user as UserContract,
		`https://jel.ly.fish/${request.arguments.thread}`,
	);
	const message = `Email(s) sent:\n${sendEmailResults
		.map((result) => {
			return `- ${result.to.join(',')} (id: ${result.id})`;
		})
		.join('\n')}`;

	// Return whisper to user
	const date = new Date();
	await context.insertCard(
		session,
		actionRequest as TypeContract,
		{
			actor: request.actor,
			timestamp: date.toISOString(),
			attachEvents: true,
		},
		{
			data: {
				actor: hubot.id,
				context: request.logContext,
				action: 'action-create-event@1.0.0',
				card: request.arguments.thread,
				type: 'thread@1.0.0',
				epoch: date.valueOf(),
				timestamp: date.toISOString(),
				input: {
					id: request.arguments.thread,
				},
				arguments: {
					type: 'whisper',
					payload: {
						message,
					},
				},
			},
		},
	);

	return results;
};

export const actionHubotEmailHashtags: ActionDefinition = {
	handler,
	contract: {
		slug: 'action-hubot-email-hashtags',
		version: '1.0.0',
		type: 'action@1.0.0',
		data: {
			filter: {
				type: 'object',
				required: ['type'],
				properties: {
					type: {
						type: 'string',
						enum: ['message@1.0.0', 'whisper@1.0.0'],
					},
				},
			},
			arguments: {
				thread: {
					type: 'string',
				},
			},
		},
	},
};
