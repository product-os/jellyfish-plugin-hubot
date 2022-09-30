import { testUtils as wTestUtils } from '@balena/jellyfish-worker';
import { testUtils as aTestUtils, OrgContract, UserContract } from 'autumndb';

export async function createUser(
	ctx: wTestUtils.TestContext,
	org: OrgContract,
): Promise<UserContract> {
	const user = await ctx.createUser(
		aTestUtils.generateRandomId().split('-')[0],
	);
	await ctx.createLink(org, user, 'has member', 'is member of');
	return user;
}
