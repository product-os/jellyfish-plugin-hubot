import type { ActionDefinition } from '@balena/jellyfish-worker';
import { strict as assert } from 'assert';
import type { TypeContract } from 'autumndb';
import * as _ from 'lodash';
import { fetchSupportSlots } from './action-hubot-support-list';
import { getBalenaUsers } from '../calamari';

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

	// Make a message with list of users on support
	const message = (contract.data.payload as any).message;
	const match = message.match(/@support-(now|today)/);
	if (match && match[1]) {
		// Get balena users
		const users = await getBalenaUsers(context);
		const slots = await fetchSupportSlots(users, match[1]);
		const targets: string[] = [];
		for (const slot of slots) {
			targets.push(`@${slot.summary.split(' ')[0]}`);
		}

		// Replace support mention with targets
		const updatedMessage = `${message
			.replace(/@support-(now|today)/, '')
			.trim()} ${targets.sort().join(' ')}`;

		// Patch original message/whisper
		const date = new Date();
		await context.insertCard(
			context.privilegedSession,
			actionRequest as TypeContract,
			{
				actor: contract.data.actor as string,
				timestamp: date.toISOString(),
				attachEvents: false,
			},
			{
				data: {
					actor: contract.data.actor as string,
					context: request.logContext,
					action: 'action-update-card@1.0.0',
					card: contract.id,
					type: contract.type,
					epoch: date.valueOf(),
					timestamp: date.toISOString(),
					input: {
						id: contract.id,
					},
					arguments: {
						reason: 'set support group ping',
						patch: [
							{
								op: 'replace',
								path: '/data/payload/message',
								value: updatedMessage,
							},
						],
					},
				},
			},
		);
	}

	return {
		id: contract.id,
		type: contract.type,
		version: contract.version,
		slug: contract.slug,
	};
};

export const actionHubotSupportMentions: ActionDefinition = {
	handler,
	contract: {
		slug: 'action-hubot-support-mentions',
		version: '1.0.0',
		type: 'action@1.0.0',
		data: {
			arguments: {},
		},
	},
};
