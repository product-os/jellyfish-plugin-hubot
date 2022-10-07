import { parseTimeframe } from '../../../lib/actions/action-hubot-support-list';

describe('parseTimeFrame()', () => {
	it('should return "now" by default', () => {
		expect(parseTimeframe('@hubot whos on support')).toEqual('now');
		expect(parseTimeframe("@hubot who's on support")).toEqual('now');
		expect(parseTimeframe('@hubot whos on support?')).toEqual('now');
		expect(parseTimeframe("@hubot who's on support?")).toEqual('now');
		expect(parseTimeframe('@hubot whos on support now?')).toEqual('now');
		expect(parseTimeframe("@hubot who's on support now?")).toEqual('now');
	});

	it('should return "today" when in message', () => {
		expect(parseTimeframe('@hubot whos on support today')).toEqual('today');
		expect(parseTimeframe("@hubot who's on support today")).toEqual('today');
		expect(parseTimeframe('@hubot whos on support today?')).toEqual('today');
		expect(parseTimeframe("@hubot who's on support today?")).toEqual('today');
	});

	it('should return "tomorror" when in message', () => {
		expect(parseTimeframe('@hubot whos on support tomorrow')).toEqual(
			'tomorrow',
		);
		expect(parseTimeframe("@hubot who's on support tomorrow")).toEqual(
			'tomorrow',
		);
		expect(parseTimeframe('@hubot whos on support tomorrow?')).toEqual(
			'tomorrow',
		);
		expect(parseTimeframe("@hubot who's on support tomorrow?")).toEqual(
			'tomorrow',
		);
	});
});
