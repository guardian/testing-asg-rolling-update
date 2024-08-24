import { main } from './index';

describe('The lambda', () => {
	beforeAll(() => {
		process.env.STACK = 'playground';
		process.env.STAGE = 'TEST';
		process.env.APP = 'event-forwarder';
	});

	it('should return a greeting', async () => {
		const response = await main();
		expect(response).toContain(
			'Hello from event-forwarder in TEST! The time is ',
		);
	});
});
