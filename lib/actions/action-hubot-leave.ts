import type { LogContext } from '@balena/jellyfish-logger';
import type { ActionDefinition } from '@balena/jellyfish-worker';
import { strict as assert } from 'assert';
import type { TypeContract, UserContract } from 'autumndb';
import * as _ from 'lodash';
import * as moment from 'moment';
import { Calamari, getBalenaUsers, Leave } from '../calamari';

/**
 * Get the next working day for a given point in time
 * @param date - time to calculate from
 * @returns next working day
 */
export function nextWorkingDay(date: moment.Moment): moment.Moment {
	// 5: Friday
	// 6: Saturday
	if (date.day() === 5) {
		date.add(3, 'days');
	} else if (date.day() === 6) {
		date.add(2, 'days');
	} else {
		date.add(1, 'days');
	}
	return date;
}

/**
 * Check if leave list request message or not
 * @param message - message to Check
 * @returns true if leave list request message
 */
export function isListRequest(message: string): boolean {
	return /(?:on\s+leave|off\s+today)/i.test(message);
}

/**
 * Extract user slugs from mentions in message
 * @param message - message to extract from
 * @returns array of user slugs
 */
export function mentionsToSlugs(message: string): string[] {
	const slugs: string[] = [];
	const exclude = ['t', 'thread', 'people', 'hubot'];
	for (const mention of message.match(/(?:\s@|^@)([a-z0-9-]+)/gi) || []) {
		const username = mention.replace('@', '').trim();
		if (!exclude.includes(username)) {
			slugs.push(`user-${username}`);
		}
	}

	return slugs;
}

/**
 * Get and return leave data for a set of users
 * @param logContext - log context
 * @param calamari - calamari instance
 * @param users - users to get leave data format
 * @returns leave data
 */
async function getLeaveList(
	logContext: LogContext,
	calamari: Calamari,
	users: UserContract[],
): Promise<string> {
	let response = '';

	// Map emails to user slug
	const targets: { [key: string]: string } = {};
	_.forEach(users, (user) => {
		const email = _.castArray(user.data.email)[0];
		if (email) {
			targets[email] = user.slug.replace(/^user-/, '');
		}
	});

	// Send request to Calamari and respond to the user
	let to = moment();
	const vacationeers = await calamari.getLeave(logContext, targets, to);
	if (vacationeers[0] && vacationeers[0][0]) {
		const results: string[] = [];
		const calendarFormat = {
			sameDay: '[today, the ]Do',
			nextDay: '[tomorrow, the ]Do',
			nextWeek: 'dddd[ the ]Do',
			sameElse: 'Do MMMM',
		};

		for (const vacationeer of vacationeers) {
			if (!vacationeer[0]) {
				continue;
			}
			const leaves = _.values(
				calamari.getAllVacations(targets[vacationeer[0].email]),
			);
			for (const vacation of vacationeer) {
				to = nextWorkingDay(moment(vacation.to));
				const from = moment(vacation.from);
				for (const leave of _.sortBy(leaves, 'from')) {
					if (leave.from === moment(to).format('YYYY-MM-DD')) {
						to = nextWorkingDay(moment(leave.to));
					}
				}
				let output = `${targets[vacation.email]} is on leave, `;
				if (from.isSame(to)) {
					calendarFormat.nextWeek = '[on ]' + calendarFormat.nextWeek;
					calendarFormat.sameElse = '[on ]' + calendarFormat.sameElse;
					output = `${output}${to.calendar(null, calendarFormat)}.`;
				} else {
					if (from > moment()) {
						output = `${output}from ${from.calendar(null, calendarFormat)}, `;
					}
					output = `${output}returning to work ${to.calendar(
						null,
						calendarFormat,
					)}.`;
				}
				results.push(output);
			}
		}
		if (results.length > 1) {
			response = '\r\n' + results.join('\r\n');
		} else if (results.length === 1) {
			response = results[0];
		} else {
			response = 'No one is on leave.';
		}
	} else {
		response = 'No one is on leave.';
	}

	return response;
}

/**
 * Get and return leave data for mentioned users
 * @param logContext - log context
 * @param calamari - calamari instance
 * @param users - users to get leave data for
 * @returns leave data
 */
async function getMentionedUserLeaves(
	logContext: LogContext,
	calamari: Calamari,
	users: UserContract[],
) {
	const leaves: { [key: string]: Leave } = {};
	for (const user of users) {
		const leave = await calamari.getCurrentLeave(logContext, user);
		if (leave) {
			leaves[user.slug] = leave;
		}
	}

	const results: string[] = [];
	const today = moment().startOf('day');
	const calendarFormat = {
		sameDay: '[today, the ]Do',
		nextDay: '[tomorrow, the ]Do',
		nextWeek: 'dddd[ the ]Do',
		sameElse: '[the ]Do MMMM',
	};

	for (const slug of Object.keys(leaves)) {
		const leave = leaves[slug];
		let partial = '';
		if (leave.firstDayHalf && moment(leave.from).diff(today, 'days') === 0) {
			partial = ' for part of';
		} else if (
			leave.lastDayHalf &&
			moment(leave.to).diff(today, 'days') === 0
		) {
			partial = ' for part of';
		}
		let returnToWork = nextWorkingDay(moment(leave.to)).calendar(
			null,
			calendarFormat,
		);
		const vacations = calamari.getAllVacations(slug);
		const isWeekend = (day: moment.Moment) => {
			return _.includes([0, 6], moment(day).day());
		};
		const isInRanges = (day: moment.Moment, ranges: Leave[]) => {
			return _.some(ranges, (range) => {
				return moment(day).isBetween(range.from, range.to, 'day', '[]');
			});
		};

		const returnToWorkUpdated = moment(today);
		while (
			isWeekend(returnToWorkUpdated) ||
			isInRanges(returnToWorkUpdated, vacations)
		) {
			returnToWorkUpdated.add(1, 'day');
		}
		returnToWork = returnToWorkUpdated.calendar(null, calendarFormat);
		results.push(
			`${slug.replace(
				/^user-/,
				'',
			)} is on leave${partial} today, returning to work ${returnToWork}`,
		);
	}

	return results.join('\r\n');
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

	// Set response message depending on request contents
	const calamari = new Calamari();
	let response = '';
	const message = (contract.data.payload as any).message;
	if (isListRequest(message)) {
		// Get list of all balena users on leave today
		const users = await getBalenaUsers(context);
		response = await getLeaveList(request.logContext, calamari, users);
	} else {
		// Check if any mentioned users are on leave today
		const slugs = mentionsToSlugs(message);
		if (slugs.length > 0) {
			const users = await getBalenaUsers(context, {
				enum: slugs,
			});
			response = await getMentionedUserLeaves(
				request.logContext,
				calamari,
				users,
			);
		}
	}

	const results = {
		id: contract.id,
		type: contract.type,
		version: contract.version,
		slug: contract.slug,
	};
	if (response === '') {
		return results;
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

	return results;
};

export const actionHubotLeave: ActionDefinition = {
	handler,
	contract: {
		slug: 'action-hubot-leave',
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
