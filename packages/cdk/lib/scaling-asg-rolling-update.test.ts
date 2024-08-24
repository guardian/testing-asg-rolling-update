import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { ScalingAsgRollingUpdate } from './scaling-asg-rolling-update';

describe('The ScalingAsgRollingUpdate stack', () => {
	it('matches the snapshot', () => {
		const app = new App();
		const stack = new ScalingAsgRollingUpdate(app, {
			buildIdentifier: 'ABC',
		});
		const template = Template.fromStack(stack);
		expect(template.toJSON()).toMatchSnapshot();
	});
});
