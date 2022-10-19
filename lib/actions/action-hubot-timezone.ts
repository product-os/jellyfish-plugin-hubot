import type { ActionDefinition } from '@balena/jellyfish-worker';
import { strict as assert } from 'assert';
import type { TypeContract } from 'autumndb';
import { parseDate } from 'chrono-node';
import * as _ from 'lodash';
import { Moment, tz } from 'moment-timezone';
import * as moment from 'moment';

const DEFAULT_TIMEZONE = 'Europe/London';

interface TimeQuery {
	to: string;
	from: string;
	time: Moment;
}

interface Times {
	to: string;
	from: string;
}

/**
 * A dictionary to translate human prepositions into strict object
 * properties
 */
const queryTranslations: { [key: string]: keyof Times } = {
	in: 'to',
	to: 'to',
	from: 'from',
};

/** A dictionary of city names to timezone definitions */
const timezonesByCity: { [key: string]: string } = {};
_.forEach(tz.names(), (timezone: string) => {
	const splitZone = timezone.split('/');
	const city = splitZone[splitZone.length - 1];
	timezonesByCity[city.toLowerCase()] = timezone;
});

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

	// A query, to mutate as required
	const query: TimeQuery = {
		to: DEFAULT_TIMEZONE,
		from: DEFAULT_TIMEZONE,
		time: tz(),
	};
	const times: Times = {
		to: DEFAULT_TIMEZONE,
		from: DEFAULT_TIMEZONE,
	};

	/**
	 * Go through the words in the message, tracking prepositions and then
	 * mutating properties.
	 */
	let section: keyof Times | null = null;
	const message = (contract.data.payload as any).message.replace(
		/@hubot\s+what\s+time\s+is\s+/i,
		'',
	);
	_.forEach(message.match(/([\w\/]+)/g), (word: string) => {
		if (queryTranslations[word]) {
			section = queryTranslations[word];
		} else if (section) {
			times[section] = timezonesByCity[word.toLowerCase()] || word;
			section = null;
		}
	});

	// If there is a time in the message, mutate the query with that
	let response = 'Location not recognised';
	query.from = times.from;
	query.to = times.to;
	if (tz.zone(query.from) && tz.zone(query.to)) {
		const timeFound = parseDate(message, {
			timezone: moment().tz(query.from).utcOffset(),
		});
		if (timeFound) {
			query.time = tz(timeFound, query.from);
			response = query.time.tz(query.to).format('LT');
		}
	}

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

export const actionHubotTimezone: ActionDefinition = {
	handler,
	contract: {
		slug: 'action-hubot-timezone',
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
