import { defaultEnvironment } from '@balena/jellyfish-environment';
import { getLogger, LogContext } from '@balena/jellyfish-logger';
import { WorkerContext } from '@balena/jellyfish-worker';
import type { JsonSchema, UserContract } from 'autumndb';
import axios from 'axios';
import { Base64 } from 'js-base64';
import * as _ from 'lodash';
import * as LRU from 'lru-cache';
import * as moment from 'moment';
import { setTimeout as delay } from 'timers/promises';

const env = defaultEnvironment.hubot;
const logger = getLogger(__filename);
const LEAVE_CACHE = new LRU({
	max: 200,
});

// Number of times to retry Calamari API calls
const RETRY = 8;
const DELAY = 1000;

export interface Leave {
	email: string;
	from: string;
	to: string;
	status: string;
	firstDayHalf: boolean;
	lastDayHalf: boolean;
}

/**
 * Get all balena users, excluding hubot
 * @param context - worker context
 * @returns array of users
 */
export async function getBalenaUsers(
	context: WorkerContext,
	slugSchema?: JsonSchema,
): Promise<UserContract[]> {
	const slug: JsonSchema = slugSchema || {
		not: {
			const: 'user-hubot',
		},
	};
	const users: UserContract[] = await context.query(context.privilegedSession, {
		type: 'object',
		required: ['type', 'data', 'slug'],
		properties: {
			type: {
				const: 'user@1.0.0',
			},
			data: {
				type: 'object',
				required: ['email'],
				properties: {
					email: {
						pattern: '@balena.io$',
					},
				},
			},
			slug,
		},
		$$links: {
			'is member of': {
				type: 'object',
				required: ['type', 'slug'],
				properties: {
					type: {
						type: 'string',
						const: 'org@1.0.0',
					},
					slug: {
						type: 'string',
						const: 'org-balena',
					},
				},
			},
		},
	});

	// Set each users email to their balena email only
	for (const user of users) {
		const email = _.castArray(user.data.email).find((value) => {
			return value.match(/@balena.io$/);
		});
		if (email) {
			user.data.email = email;
		}
	}

	return users;
}

// Class used to communicate with Calamari API
export class Calamari {
	/**
	 * Get and cache user leave data
	 * @param logContext - log context
	 * @param context - worker context
	 */
	public async updateLeave(
		logContext: LogContext,
		context: WorkerContext,
	): Promise<void> {
		logger.info(logContext, '[leave] Updating leave cache');
		const users = await getBalenaUsers(context);
		const today = moment();
		const soon = today.clone().add(3, 'months');
		const emailToUsersMap: { [key: string]: UserContract } = {};
		for (const user of users) {
			const email = _.castArray(user.data.email)[0];
			if (email) {
				emailToUsersMap[email] = user;
			}
		}
		try {
			for (const email of Object.keys(emailToUsersMap)) {
				const user = emailToUsersMap[email];
				if (!LEAVE_CACHE.get(user.slug)) {
					const leaveEvents = await this.getLeaveFromCalamari(
						logContext,
						email,
						today,
						soon,
					);
					LEAVE_CACHE.set(
						user.slug,
						leaveEvents.sort((a: Leave, b: Leave) => {
							return moment(a.from).diff(moment(b.from));
						}),
					);
					await delay(100);
				}
			}
		} catch (error: any) {
			logger.error(logContext, error);
		}
		logger.info(logContext, '[leave] Updated leave cache');
	}

	/*
	 * Gets a user's leave details for a period that overlaps with today
	 * @param logContext - log context
	 * @param user - user contract to retrieve
	 * @returns user leave data or undefined
	 */
	public async getCurrentLeave(
		logContext: LogContext,
		user: UserContract,
	): Promise<Leave | undefined> {
		const rightNow = moment();
		if (!LEAVE_CACHE.has(user.slug)) {
			const leaveEvents = await this.getLeaveFromCalamari(
				logContext,
				_.castArray(user.data.email)[0],
				moment(),
				moment(),
			);
			LEAVE_CACHE.set(
				user.slug,
				leaveEvents.sort((a: Leave, b: Leave) => {
					return moment(a.from).diff(moment(b.from));
				}),
			);
		}
		return (LEAVE_CACHE.get(user.slug) as Leave[]).find((leave) => {
			return (
				moment(leave.to).isSameOrAfter(rightNow, 'day') &&
				moment(leave.from).isSameOrBefore(rightNow, 'day')
			);
		});
	}

	/**
	 * Retrieves the complete cache of a user's leave
	 * @param slug - slug of user to retrieve
	 * @returns user leave data
	 */
	public getAllVacations(slug: string): Leave[] {
		if (LEAVE_CACHE.has(slug)) {
			return LEAVE_CACHE.get(slug) as Leave[];
		}
		return [];
	}

	/**
	 * Request leave patterns for several emails
	 * @param logContext - log context
	 * @param targets - user email to slug map
	 * @param to - the date to filter until
	 * @return leave details
	 */
	public async getLeave(
		logContext: LogContext,
		targets: { [key: string]: string },
		to: moment.Moment,
	): Promise<Leave[][]> {
		logger.info(
			logContext,
			`Requesting leave details for ${Object.keys(targets).length} users`,
		);

		// Add leave data if none currently exists
		for (const email of Object.keys(targets)) {
			const slug = targets[email];
			if (!LEAVE_CACHE.has(slug)) {
				const leave = await this.getLeaveFromCalamari(
					logContext,
					email,
					moment(),
					to,
				);
				LEAVE_CACHE.set(
					slug,
					leave.sort((a: Leave, b: Leave) => {
						return moment(a.from).diff(moment(b.from));
					}),
				);
				await delay(100);
			}
		}

		// Reduce by email
		const byEmail: Leave[][] = [];
		for (const slug of Object.values(targets)) {
			const leave = LEAVE_CACHE.get(slug) as Leave[];
			if (leave[0] && Object.keys(targets).includes(leave[0].email)) {
				byEmail.push(leave);
			}
		}

		// Reduce by date
		const from = moment();
		const byDate: Leave[][] = [];
		for (const leaves of byEmail) {
			const matches: Leave[] = [];
			for (const leave of leaves) {
				const leaveFrom = moment(leave.from);
				const leaveTo = moment(leave.to);
				if (
					from.isSame(leaveFrom, 'day') ||
					to.isSame(leaveTo, 'day') ||
					from.isBetween(leaveFrom, leaveTo, 'day') ||
					to.isBetween(leaveFrom, leaveTo, 'day')
				) {
					matches.push(leave);
				}
			}
			if (matches.length > 0) {
				byDate.push(matches);
			}
		}

		return byDate;
	}

	/**
	 * Request leave details for a user by email
	 * @param logContext - log context
	 * @param email - email address to match
	 * @param from - the date to filter from
	 * @param to - the date to filter until
	 * @param retries - how many attempts to make
	 * @return leave details
	 */
	public async getLeaveFromCalamari(
		logContext: LogContext,
		email: string,
		from: moment.Moment,
		to: moment.Moment,
		retries = RETRY,
	): Promise<Leave[]> {
		logger.info(logContext, 'Requesting leave for user', {
			email,
			retries,
		});
		try {
			const result = await axios.post(
				`https://${env.leave.calamari.instance}.calamari.io/api/leave/request/v1/find`,
				{
					employee: email,
					from: from.format('YYYY-MM-DD'),
					to: to.format('YYYY-MM-DD'),
				},
				{
					headers: {
						Accept: 'application/json',
						'Content-Type': 'application/json',
						Authorization: `Basic ${Base64.encode(
							':' + env.leave.calamari.token,
						)}`,
					},
				},
			);
			if (result.status === 200) {
				const leaves: Leave[] = [];
				for (const absence of result.data) {
					leaves.push({
						email,
						from: absence.from,
						to: absence.to,
						status: absence.status,
						firstDayHalf:
							absence.amountFirstDay && absence.amountFirstDay === '0.5',
						lastDayHalf:
							absence.amountLastDay && absence.amountLastDay === '0.5',
					});
				}
				return leaves;
			} else if (
				result.status < 600 &&
				(result.status >= 500 || result.status === 429) &&
				retries > 0
			) {
				// If the status code indicates temporary outage then recurse our promise
				await delay(DELAY);
				return this.getLeaveFromCalamari(
					logContext,
					email,
					from,
					to,
					retries - 1,
				);
			} else {
				logger.error(logContext, `Failed to get leave detalis for ${email}`, {
					status: result.status,
					statusText: result.statusText,
				});
				return [];
			}
		} catch (error: any) {
			if (
				error.response &&
				error.response.status &&
				error.response.status < 600 &&
				(error.response.data >= 500 || error.response.data === 429)
			) {
				// If the status code indicates temporary outage then wait and try again
				await delay(DELAY);
				return this.getLeaveFromCalamari(
					logContext,
					email,
					from,
					to,
					retries - 1,
				);
			} else {
				logger.error(
					logContext,
					`Failed to get leave details for ${email}: ${error}`,
				);
				return [];
			}
		}
	}
}
