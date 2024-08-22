import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { TestingAsgRollingUpdate } from './testing-asg-rolling-update';

describe('The TestingAsgRollingUpdate stack', () => {
	it('matches the snapshot', () => {
		const app = new App();
		const stack = new TestingAsgRollingUpdate(app, 'TestingAsgRollingUpdate', {
			stack: 'playground',
			stage: 'TEST',
			buildIdentifier: 'ABC',
		});
		const template = Template.fromStack(stack);
		expect(template.toJSON()).toMatchSnapshot();
	});
});
