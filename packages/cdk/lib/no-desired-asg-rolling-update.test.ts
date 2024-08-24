import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { NoDesiredAsgRollingUpdate } from './no-desired-asg-rolling-update';

describe('The NoDesiredAsgRollingUpdate stack', () => {
	it('matches the snapshot', () => {
		const app = new App();
		const stack = new NoDesiredAsgRollingUpdate(app, {
			buildIdentifier: 'ABC',
		});
		const template = Template.fromStack(stack);
		expect(template.toJSON()).toMatchSnapshot();
	});
});
