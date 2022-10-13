import { defaultEnvironment } from '@balena/jellyfish-environment';
import { getLogger, LogContext } from '@balena/jellyfish-logger';
import type { ActionDefinition } from '@balena/jellyfish-worker';
import { strict as assert } from 'assert';
import type { TypeContract, UserContract } from 'autumndb';
import { calendar_v3 } from 'googleapis';
import * as _ from 'lodash';
import * as LRU from 'lru-cache';
import * as moment from 'moment';
import { fetchCalendarEvents } from './calendar-utils';
import { getBalenaUsers } from '../calamari';

const env = defaultEnvironment.hubot.support;
const logger = getLogger(__filename);

// Local cache to keep track of notified shift starts/ends
const NOTIFIED_START_CACHE = new LRU({
	max: 200,
	ttl: 1000 * 60 * 60,
	allowStale: false,
	updateAgeOnGet: false,
	updateAgeOnHas: false,
});
const NOTIFIED_END_CACHE = new LRU({
	max: 200,
	ttl: 1000 * 60 * 60,
	allowStale: false,
	updateAgeOnGet: false,
	updateAgeOnHas: false,
});

interface TemplateObject {
	summary: string;
	ping: string;
	start: string;
	end: string;
	duration: string;
}

/**
 * @summary Make string with ping targets for notification message
 * @function
 *
 * @param users - balena users
 * @param attendees - attendees of the calendar event
 * @returns string with pings
 */
export function makePingString(
	users: UserContract[],
	attendees: calendar_v3.Schema$EventAttendee[],
): string {
	const ping: string[] = [];

	for (const attendee of attendees) {
		const match = users.find((user) => user.data.email === attendee.email);
		if (match) {
			ping.push(`@${match.slug.replace(/^user-/, '')}`);
		}
	}

	return ping.join(' ');
}

/**
 * @summary Build a template object from a given event
 * @function
 *
 * @param users - balena users
 * @param event - support shift calendar event
 * @returns template object
 */
export function makeTemplateObject(
	users: UserContract[],
	event: calendar_v3.Schema$Event,
): TemplateObject | undefined {
	if (
		event.start &&
		(event.start.dateTime || event.start.date) &&
		event.end &&
		(event.end.dateTime || event.end.date) &&
		event.attendees
	) {
		const start = moment(event.start.dateTime || event.start.date);
		const end = moment(event.end.dateTime || event.end.date);
		return {
			summary: event.summary || '',
			ping: makePingString(users, event.attendees),
			start: start.fromNow(true),
			end: end.fromNow(true),
			duration: end.from(start, true),
		};
	}
}

/**
 * @summary Check if a given event is starting or ending soon
 * @function
 *
 * @param date - support shift calendar event date
 * @param multiplier - multiplier for the lookahead time
 * @returns whether the event is starting or ending soon
 */
export function isSoon(
	date: calendar_v3.Schema$EventDateTime,
	multiplier = 1,
): boolean {
	const now = moment();
	return moment(date.dateTime).isBetween(
		now,
		moment(now).add(env.lookahead * multiplier, 'minutes'),
	);
}

/**
 * @summary Check if a given event is starting or ending soon-ish
 * @function
 *
 * @param date - support shift calendar event date
 * @returns whether the event is starting or ending soon-ish
 */
export function isSoonIsh(date: calendar_v3.Schema$EventDateTime): boolean {
	return isSoon(date, 2);
}

/**
 * @summary Generate notification message for support shift handovers
 * @function
 *
 * @param logContext - log context
 * @param users - balena users
 * @returns notification message, or undefined if no message is needed
 */
async function makeHandoverMessage(
	logContext: LogContext,
	users: UserContract[],
): Promise<string | undefined> {
	// Retrieve the first page of events from the calendar
	const jwt = JSON.parse(env.jwt);
	const events = await fetchCalendarEvents(jwt.client_email, jwt.private_key, {
		calendarId: env.calendar,
		q: 'on balena-io support',
	});
	if (!events) {
		return;
	}

	// Create a list of those events that are starting or ending very soon
	const eventsToNotify = events.filter((event) => {
		if (
			(event.start && isSoon(event.start)) ||
			(event.end && isSoon(event.end))
		) {
			return true;
		} else {
			logger.error(logContext, 'Unable, to determine if event is soon', {
				event,
			});
		}
	});

	// If we've an event soon then notify about events that are soon-ish
	// This means that events that are close to each other get bundled into one notification
	if (eventsToNotify.length > 0) {
		// Create a list of those events that are ending soon-ish, and that we haven't outputted yet
		const endsToNotify = events.filter((event) => {
			if (event.end) {
				return isSoonIsh(event.end) && !NOTIFIED_END_CACHE.has(event.id);
			}
		});

		// Create a list of those events that are starting soon-ish, and that we haven't outputted yet
		const startsToNotify = events.filter((event) => {
			if (event.start) {
				return isSoonIsh(event.start) && !NOTIFIED_START_CACHE.has(event.id);
			}
		});

		// Stash a calculated string from each startToNotify and endToNotify
		const output: string[] = [];
		const startString = _.template(env.start.message);
		for (const event of startsToNotify) {
			const templateObject = makeTemplateObject(users, event);
			if (templateObject) {
				output.push(startString(templateObject));
			}
		}
		if (startsToNotify.length > 0) {
			output.push(env.start.instructions);
		}

		const createEndString = _.template(env.end.message);
		for (const event of endsToNotify) {
			const templateObject = makeTemplateObject(users, event);
			if (templateObject) {
				output.push(createEndString(templateObject));
			}
		}
		if (endsToNotify.length > 0) {
			output.push(env.end.instructions);
		}

		const importance = (a: any) => {
			const tests: any = [
				{ regex: /shift starts/i, weight: 2 },
				{ regex: /PSA/i, weight: 1 },
				{ regex: /nearing the end/i, weight: -1 },
				{ regex: /hand-over/i, weight: -2 },
			];
			const accumulator = (
				result: any,
				test: { regex: RegExp; weight: number },
			) => {
				if (test.regex.test(a)) {
					return result + test.weight;
				}
				return result;
			};
			return _.reduce(tests, accumulator, 0);
		};
		output.sort((a, b) => {
			return importance(b) - importance(a);
		});

		// If there's any output, then do it and track same
		if (output.length > 0) {
			for (const event of startsToNotify) {
				NOTIFIED_START_CACHE.set(event.id, true);
			}
			for (const event of endsToNotify) {
				NOTIFIED_END_CACHE.set(event.id, true);
			}
			return output.join('\r\n\r\n');
		}
	}
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
	const [hubot, thread] = await Promise.all([
		context.getCardBySlug(context.privilegedSession, 'user-hubot@1.0.0'),
		context.getCardById(context.privilegedSession, request.arguments.thread),
	]);
	assert(hubot, 'user-hubot not found');
	assert(thread, `thread contract not found: ${request.arguments.thread}`);

	// Get balena users
	const users = await getBalenaUsers(context);

	// Make notification message
	const message = await makeHandoverMessage(request.logContext, users);

	// Send the notification message if necessary
	if (message) {
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
					card: thread.id,
					type: 'thread@1.0.0',
					epoch: date.valueOf(),
					timestamp: date.toISOString(),
					input: {
						id: thread.id,
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
	}

	return {
		id: contract.id,
		type: contract.type,
		version: contract.version,
		slug: contract.slug,
	};
};

export const actionHubotSupportNotify: ActionDefinition = {
	handler,
	contract: {
		slug: 'action-hubot-support-notify',
		version: '1.0.0',
		type: 'action@1.0.0',
		data: {
			arguments: {
				thread: {
					type: 'string',
				},
			},
		},
	},
};
