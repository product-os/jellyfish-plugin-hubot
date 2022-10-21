import { defaultEnvironment } from '@balena/jellyfish-environment';
import { getLogger } from '@balena/jellyfish-logger';
import type { ActionDefinition } from '@balena/jellyfish-worker';
import { strict as assert } from 'assert';
import type { TypeContract, UserContract } from 'autumndb';
import { calendar_v3 } from 'googleapis';
import * as _ from 'lodash';
import * as LRU from 'lru-cache';
import * as moment from 'moment';
import { stripHtml } from 'string-strip-html';
import { createWhisper, fetchCalendarEvents } from './utils';

const logger = getLogger(__filename);
const calendarId = defaultEnvironment.hubot.calendar.id;
const ignore = JSON.parse(defaultEnvironment.hubot.calendar.ignore);
const jwt = JSON.parse(defaultEnvironment.hubot.calendar.jwt);
const lookahead = defaultEnvironment.hubot.calendar.lookahead;
const ping = defaultEnvironment.hubot.calendar.ping;
const thread = defaultEnvironment.hubot.calendar.thread;

// Define cache to hold notified events
const NOTIFIED_CACHE = new LRU({
	max: 200,
	ttl: 1000 * 60 * 60,
	allowStale: false,
	updateAgeOnGet: false,
	updateAgeOnHas: false,
});

/**
 * @summary Check if the event is ready to be notified
 * @function
 *
 * @param event - event to check
 * @returns true if the event is ready to be notified
 */
function readyToNotify(event: calendar_v3.Schema$Event): boolean {
	if (!event.start) {
		return false;
	}
	if (event.reminders?.overrides && event.reminders?.overrides[0].minutes) {
		return moment(event.start.dateTime)
			.add(-event.reminders.overrides[0].minutes, 'minute')
			.isBefore(moment());
	}
	return true;
}

/**
 * @summary Check if the event should be notified
 * @function
 *
 * @param event - event to check
 * @returns true if the event should be notified
 */
function shouldNotify(event: calendar_v3.Schema$Event): boolean {
	return (
		!NOTIFIED_CACHE.has(event.id) &&
		!ignore.includes(event.summary) &&
		readyToNotify(event)
	);
}

/**
 * @summary Parse event description
 * @function
 *
 * @param text - description text to parse
 * @returns parsed parsed description
 */
export function parseDescription(text: string): string {
	return stripHtml(
		text
			.replace(/<br\s*\/?>/gi, '\n')
			.replace(/<[^>]*>/g, '')
			.replace(/<script/g, '')
			.replace(/&nbsp;/gi, ' '),
	).result;
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

	logger.debug(request.logContext, 'Checking for events to notify');
	const events = await fetchCalendarEvents(jwt.client_email, jwt.private_key, {
		calendarId,
		timeMax: moment().add(lookahead, 'hour').toISOString(),
	});
	if (events && events.length > 0) {
		for (const event of events) {
			if (shouldNotify(event)) {
				if (!event.start) {
					continue;
				}
				NOTIFIED_CACHE.set(event.id, true);
				const timeSummary = moment(
					event.start.dateTime || event.start.date,
				).fromNow();
				const description = event.description
					? parseDescription(event.description)
					: '';
				const text = `${event.summary} ${timeSummary}\n--\n${ping}\n${description}`;

				// Ping about upcoming event
				await createWhisper(
					request.logContext,
					context,
					actionRequest as TypeContract,
					hubot as UserContract,
					thread,
					text.trim(),
				);
			}
		}
	}

	return {
		id: contract.id,
		type: contract.type,
		version: contract.version,
		slug: contract.slug,
	};
};

export const actionHubotCalendar: ActionDefinition = {
	handler,
	contract: {
		slug: 'action-hubot-calendar',
		version: '1.0.0',
		type: 'action@1.0.0',
		data: {
			arguments: {},
		},
	},
};
