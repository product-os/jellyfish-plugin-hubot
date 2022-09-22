import type { PluginDefinition } from '@balena/jellyfish-worker';
import { actions } from './actions';
import { contracts } from './contracts';

// tslint:disable-next-line: no-var-requires
const { version } = require('../package.json');

/**
 * The Hubot Jellyfish plugin.
 */
export const hubotPlugin = (): PluginDefinition => {
	return {
		slug: 'plugin-hubot',
		name: 'Hubot Plugin',
		version,
		contracts,
		actions,
	};
};
