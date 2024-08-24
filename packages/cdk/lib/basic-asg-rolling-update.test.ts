import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { BasicAsgRollingUpdate } from './basic-asg-rolling-update';

describe('The BasicAsgRollingUpdate stack', () => {
	it('matches the snapshot', () => {
		const app = new App();
		const stack = new BasicAsgRollingUpdate(app, {
			buildIdentifier: 'ABC',
		});
		const template = Template.fromStack(stack);
		expect(template.toJSON()).toMatchSnapshot();
	});
});
