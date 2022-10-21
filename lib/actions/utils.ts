import type { LogContext } from '@balena/jellyfish-logger';
import type { WorkerContext } from '@balena/jellyfish-worker';
import type { TypeContract, UserContract } from 'autumndb';
import { google, calendar_v3 } from 'googleapis';
import * as _ from 'lodash';
import * as moment from 'moment';

export async function createWhisper(
	logContext: LogContext,
	workerContext: WorkerContext,
	actionRequest: TypeContract,
	hubot: UserContract,
	thread: string,
	message: string,
): Promise<void> {
	const date = new Date();
	await workerContext.insertCard(
		workerContext.privilegedSession,
		actionRequest as TypeContract,
		{
			actor: hubot.id,
			timestamp: date.toISOString(),
			attachEvents: false,
		},
		{
			data: {
				actor: hubot.id,
				context: logContext,
				action: 'action-create-event@1.0.0',
				card: thread,
				type: 'thread@1.0.0',
				epoch: date.valueOf(),
				timestamp: date.toISOString(),
				input: {
					id: thread,
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

export async function fetchCalendarEvents(
	email: string,
	key: string,
	specificCriteria: any = {},
): Promise<calendar_v3.Schema$Event[] | undefined> {
	const auth = new google.auth.JWT(
		email,
		undefined,
		key,
		['https://www.googleapis.com/auth/calendar.readonly'],
		undefined,
	);
	const defaultCriteria = {
		timeMin: moment().toISOString(),
		showDeleted: false,
		orderBy: 'startTime',
		singleEvents: true,
	};
	const criteria = _.merge(defaultCriteria, specificCriteria);
	const results = await google
		.calendar({
			auth,
			version: 'v3',
		})
		.events.list(criteria);
	return results.data.items;
}
