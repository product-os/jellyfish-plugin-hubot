import { testUtils as aTestUtils, UserContract } from 'autumndb';
import { calendar_v3 } from 'googleapis';
import * as moment from 'moment';
import {
	isSoon,
	isSoonIsh,
	makePingString,
	makeTemplateObject,
} from '../../../lib/actions/action-hubot-support-notify';

const names = ['foo', 'bar'];
const users: UserContract[] = names.map((name) => {
	return {
		id: aTestUtils.generateRandomId(),
		slug: `user-${name}`,
		type: 'user@1.0.0',
		version: '1.0.0',
		active: true,
		tags: [],
		markers: [],
		requires: [],
		capabilities: [],
		created_at: new Date().toISOString(),
		data: {
			hash: aTestUtils.generateRandomId(),
			roles: ['user-community'],
			email: `${name}@buz.baz`,
		},
	};
});
const attendees: calendar_v3.Schema$EventAttendee[] = names.map((name) => {
	return {
		email: `${name}@buz.baz`,
	};
});

describe('makePingString()', () => {
	it('should return expected string of mentions', () => {
		expect(makePingString(users, attendees)).toEqual('@foo @bar');
	});
});

describe('makeTemplateObject()', () => {
	it('should return expected template object', () => {
		const event: calendar_v3.Schema$Event = {
			summary: aTestUtils.generateRandomId(),
			start: {
				dateTime: moment().add(1, 'hours').format(),
			},
			end: {
				dateTime: moment().add(2, 'hours').format(),
			},
			attendees,
		};
		expect(makeTemplateObject(users, event)).toEqual({
			summary: event.summary,
			duration: 'an hour',
			ping: '@foo @bar',
			start: 'an hour',
			end: '2 hours',
		});
	});
});

describe('isSoon()', () => {
	it('should return true if event is soon', () => {
		const date: calendar_v3.Schema$EventDateTime = {
			dateTime: moment().add(1, 'minutes').format(),
		};
		expect(isSoon(date)).toEqual(true);
	});

	it('should return false if event is not soon', () => {
		const date: calendar_v3.Schema$EventDateTime = {
			dateTime: moment().add(1, 'days').format(),
		};
		expect(isSoon(date)).toEqual(false);
	});
});

describe('isSoonIsh()', () => {
	it('should return true if event is soon-ish', () => {
		const date: calendar_v3.Schema$EventDateTime = {
			dateTime: moment().add(1, 'minutes').format(),
		};
		expect(isSoonIsh(date)).toEqual(true);
	});

	it('should return false if event is not soon-ish', () => {
		const date: calendar_v3.Schema$EventDateTime = {
			dateTime: moment().add(1, 'days').format(),
		};
		expect(isSoonIsh(date)).toEqual(false);
	});
});
