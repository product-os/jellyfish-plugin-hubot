import { getLogger, LogContext } from '@balena/jellyfish-logger';
import { ActionDefinition, WorkerContext } from '@balena/jellyfish-worker';
import { strict as assert } from 'assert';
import type { TypeContract, UserContract } from 'autumndb';
import * as chrono from 'chrono-node';
import * as _ from 'lodash';
import { v4 as uuid } from 'uuid';
import { createWhisper } from './utils';

const logger = getLogger(__filename);

/**
 * Schedule reminder for future execution
 * @param logContext - log context
 * @param workerContext - worker context
 * @param actionRequest - action-request type
 * @param scheduledAction - scheduled-action type
 * @param hubot - hubot user
 * @param date - date to schedule reminder
 * @param thread - thread to post reminder in
 * @param message - message to post
 */
export async function scheduleReminder(
	logContext: LogContext,
	workerContext: WorkerContext,
	actionRequest: TypeContract,
	scheduledAction: TypeContract,
	hubot: UserContract,
	date: Date,
	thread: string,
	message: string,
): Promise<void> {
	logger.info(logContext, 'Scheduling reminder', {
		date: date.toISOString(),
		message,
	});

	// Schedule reminder whisper to be created in the future
	const now = new Date();
	await workerContext.insertCard(
		workerContext.privilegedSession,
		actionRequest,
		{},
		{
			data: {
				actor: hubot.id,
				epoch: now.valueOf(),
				input: {
					id: scheduledAction.id,
				},
				timestamp: now.toISOString(),
				action: 'action-create-card@1.0.0',
				context: logContext,
				card: scheduledAction.id,
				type: scheduledAction.type,
				arguments: {
					reason: null,
					properties: {
						slug: `scheduled-action-${uuid()}`,
						version: '1.0.0',
						data: {
							options: {
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
							schedule: {
								once: {
									date,
								},
							},
						},
					},
				},
			},
		},
	);
}

const handler: ActionDefinition['handler'] = async (
	_session,
	context,
	contract,
	request,
) => {
	const results = {
		id: contract.id,
		type: contract.type,
		version: contract.version,
		slug: contract.slug,
	};

	// Get required contracts
	const actionRequest = context.cards['action-request@1.0.0'] as TypeContract;
	const scheduledAction = context.cards[
		'scheduled-action@1.0.0'
	] as TypeContract;
	assert(actionRequest, 'action-request type not found');
	assert(scheduledAction, 'scheduled-action type not found');
	const [hubot, sender] = await Promise.all([
		context.getCardBySlug(context.privilegedSession, 'user-hubot@1.0.0'),
		context.getCardById(
			context.privilegedSession,
			contract.data.actor as string,
		),
	]);
	assert(hubot, 'user-hubot not found');
	assert(sender, `user not found: ${contract.data.actor}`);

	// Break the text down into sections, around first instances of 'remind', 'in|on' & 'to'
	const text = (contract.data.payload as any).message;
	const splits = [
		text.search(/\bremind\b/i),
		text.search(/\bin|on\b/i),
		text.search(/\bto\b/i),
	].sort((a, b) => {
		return a - b;
	});
	let priorSplitPoint: number | null = null;
	const substrings: string[] = [];
	_.forEach(
		_.filter(splits, (index) => {
			return index >= 0;
		}),
		(splitPoint) => {
			if (priorSplitPoint) {
				substrings.push(
					text.substr(priorSplitPoint, splitPoint - priorSplitPoint).trim(),
				);
			}
			priorSplitPoint = splitPoint;
		},
	);
	if (priorSplitPoint) {
		substrings.push(text.substr(priorSplitPoint).trim());
	}

	// Parse custom options from raw text
	let time = 'in 1 day';
	let action = 'to do this ^^^';
	for (const substring of substrings) {
		// Put each of the unordered substrings into keyed object properties.
		const match = substring.match(/^(in|on|to)\b/i);
		if (match && match[0]) {
			const keyword = match[0].toString();
			if (keyword === 'to') {
				action = substring;
			} else {
				time = substring;
			}
		}
	}

	// Perform some intermediary calculations on the reminder object
	const date = chrono.parseDate(time);

	// Create the deferred reminder
	await scheduleReminder(
		request.logContext,
		context,
		actionRequest as TypeContract,
		scheduledAction as TypeContract,
		hubot as UserContract,
		date,
		request.arguments.thread,
		`Hey @${sender.slug.replace(/^user-/, '')} remember ${action}`,
	);

	// Send reminder confirmation whisper to user
	await createWhisper(
		request.logContext,
		context,
		actionRequest as TypeContract,
		hubot as UserContract,
		request.arguments.thread,
		`Got it, will remind ${sender.slug.replace(
			/^user-/,
			'',
		)} on ${date.toISOString()} ${action}`,
	);

	return results;
};

export const actionHubotRemind: ActionDefinition = {
	handler,
	contract: {
		slug: 'action-hubot-remind',
		version: '1.0.0',
		type: 'action@1.0.0',
		data: {
			filter: {
				type: 'object',
				required: ['type'],
				properties: {
					type: {
						type: 'string',
						enum: ['message@1.0.0', 'whisper@1.0.0'],
					},
				},
			},
			arguments: {
				thread: {
					type: 'string',
				},
			},
		},
	},
};
