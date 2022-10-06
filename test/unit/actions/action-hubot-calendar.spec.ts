import { parseDescription } from '../../../lib/actions/action-hubot-calendar';

describe('parseDescription', () => {
	it('should properly parse text', () => {
		const result = parseDescription('foo<br><div>bar<br>buz</div>&nbsp;baz');
		expect(result).toEqual('foo\nbar\nbuz baz');
	});
});
