import * as moment from 'moment';
import {
	isListRequest,
	mentionsToSlugs,
	nextWorkingDay,
} from '../../../lib/actions/action-hubot-leave';

describe('isListRequest', () => {
	it('should return true if message contains "on leave"', () => {
		expect(isListRequest('@hubot whos on leave')).toBe(true);
		expect(isListRequest("@hubot who's on leave")).toBe(true);
		expect(isListRequest('@hubot whos on leave?')).toBe(true);
		expect(isListRequest("@hubot who's on leave?")).toBe(true);
	});

	it('should return true if message contains "off today"', () => {
		expect(isListRequest('@hubot whos off today')).toBe(true);
		expect(isListRequest("@hubot who's off today")).toBe(true);
		expect(isListRequest('@hubot whos off today?')).toBe(true);
		expect(isListRequest("@hubot who's off today?")).toBe(true);
	});

	it('should return false if message does not contain trigger words', () => {
		expect(isListRequest('@hubot echo test')).toBe(false);
	});
});

describe('mentionsToSlugs', () => {
	it('should return list of users', () => {
		expect(mentionsToSlugs('@foo test @bar')).toEqual(['user-foo', 'user-bar']);
	});

	it('should ignore group mentions', () => {
		expect(mentionsToSlugs('@foo test @bar @@buz test')).toEqual([
			'user-foo',
			'user-bar',
		]);
	});

	it('should ignore special mentions', () => {
		expect(mentionsToSlugs('@people test @bar @thread @t @hubot test')).toEqual(
			['user-bar'],
		);
	});
});

describe('nextWorkingDay', () => {
	it('should return following Monday if Saturday', () => {
		expect(nextWorkingDay(moment('2022-10-01')).day()).toEqual(1);
	});

	it('should return following Monday if Sunday', () => {
		expect(nextWorkingDay(moment('2022-10-02')).day()).toEqual(1);
	});

	it('should return next day for working day', () => {
		expect(nextWorkingDay(moment('2022-10-04')).day()).toEqual(3);
	});
});
