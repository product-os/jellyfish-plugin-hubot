import { google, calendar_v3 } from 'googleapis';
import * as _ from 'lodash';
import * as moment from 'moment';

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
