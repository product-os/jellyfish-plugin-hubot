import { PluginManager } from '@balena/jellyfish-worker';
import { hubotPlugin } from '../../lib/index';

const pluginManager = new PluginManager([hubotPlugin()]);

test('Expected contracts are loaded', () => {
	const contracts = pluginManager.getCards();
	expect(contracts['triggered-action-hubot-echo'].name).toEqual(
		'Triggered action for hubot echo',
	);
});
