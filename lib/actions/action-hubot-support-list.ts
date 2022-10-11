import { defaultEnvironment } from '@balena/jellyfish-environment';
import type { ActionDefinition } from '@balena/jellyfish-worker';
import { strict as assert } from 'assert';
import type { TypeContract, UserContract } from 'autumndb';
import * as _ from 'lodash';
import * as moment from 'moment';
import { fetchCalendarEvents } from './calendar-utils';
import { getBalenaUsers } from '../calamari';

const env = defaultEnvironment.hubot.support;

interface SupportSlot {
	summary: string;
	start: moment.Moment;
	end: moment.Moment;
	attendees: string[];
}

/**
 * @summary Parse support timespan string from message
 * @function
 *
 * @param message - message to parse
 * @returns timeframe string
 */
export function parseTimeframe(message: string): string {
	let timeframe = 'now';

	for (const option of ['today', 'tomorrow']) {
		if (message.includes(option)) {
			timeframe = option;
			break;
		}
	}

	return timeframe;
}

/**
 * @summary Fetch support slots from Google Calendar in a given timeframe
 * @function
 *
 * @param users - list of users to search for
 * @param timeframe - timeframe to fetch
 * @returns support slots
 */
export async function fetchSupportSlots(
	users: UserContract[],
	timeframe: string,
): Promise<SupportSlot[]> {
	const supportSlots: SupportSlot[] = [];
	const jwt = JSON.parse(env.jwt);
	const events = await fetchCalendarEvents(jwt.client_email, jwt.private_key, {
		calendarId: env.calendar,
	});
	if (!events) {
		return supportSlots;
	}

	// Stash an object of email -> username
	const usernames: { [key: string]: string } = {};
	for (const user of users) {
		usernames[user.data.email as string] = user.slug.replace(/^user-/, '');
	}

	// Filter to the events that match and simplify for render
	for (const event of events) {
		if (
			!event.start ||
			!event.start.dateTime ||
			!event.end ||
			!event.end.dateTime
		) {
			continue;
		}
		if (
			(timeframe === 'now' &&
				moment().isBetween(event.start.dateTime, event.end.dateTime)) ||
			(timeframe === 'today' && moment().isSame(event.start.dateTime, 'day')) ||
			(timeframe === 'tomorrow' &&
				moment().add(1, 'days').isSame(event.start.dateTime, 'day'))
		) {
			supportSlots.push({
				summary: event.summary || '',
				start: moment(event.start.dateTime),
				end: moment(event.end.dateTime),
				attendees: _.map(event.attendees, (attendee) => {
					return (
						usernames[attendee.email as string] || attendee.email || 'unknown'
					);
				}),
			});
		}
	}

	return supportSlots;
}

/**
 * @summary Build message to notify users whose support shift is starting/ending soon
 * @function
 *
 * @param users - list of users to search support shifts for
 * @param timeframe - timeframe to fetch
 * @returns message to send
 */
export async function makeListMessage(
	users: UserContract[],
	timeframe: string,
): Promise<string> {
	const slots = await fetchSupportSlots(users, timeframe);
	let message = 'No one is on support at the moment';

	const output: string[] = [];
	for (const slot of slots) {
		const verb = slot.start.isBefore() ? 'ending' : 'starting';
		output.push(`${slot.summary}, ${verb} in ${slot.end.fromNow(true)}.`);
	}
	const results = output.join('\r\n').split('@').join('');
	if (results.trim().length > 0) {
		message = results;
	}

	return message;
}

const handler: ActionDefinition['handler'] = async (
	_session,
	context,
	contract,
	request,
) => {
	// Get required contracts
	const actionRequest = context.cards['action-request@1.0.0'] as TypeContract;
	assert(actionRequest, 'action-request type not found');
	const hubot = await context.getCardBySlug(
		context.privilegedSession,
		'user-hubot@1.0.0',
	);
	assert(hubot, 'user-hubot not found');

	// Get balena users
	const users = await getBalenaUsers(context);

	// Make a message with list of users on support
	const timeframe = parseTimeframe((contract.data.payload as any).message);
	const response = await makeListMessage(users, timeframe);

	// Send the message to the support thread
	const date = new Date();
	await context.insertCard(
		context.privilegedSession,
		actionRequest as TypeContract,
		{
			actor: hubot.id,
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
						message: response,
					},
				},
			},
		},
	);

	return {
		id: contract.id,
		type: contract.type,
		version: contract.version,
		slug: contract.slug,
	};
};

export const actionHubotSupportList: ActionDefinition = {
	handler,
	contract: {
		slug: 'action-hubot-support-list',
		version: '1.0.0',
		type: 'action@1.0.0',
		data: {
			arguments: {},
		},
	},
};
