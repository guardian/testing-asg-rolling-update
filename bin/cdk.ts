import 'source-map-support/register';
import { GuRoot } from '@guardian/cdk/lib/constructs/root';
import { TestingAsgRollingUpdate } from '../lib/testing-asg-rolling-update';

const app = new GuRoot();
new TestingAsgRollingUpdate(app, 'TestingAsgRollingUpdate-euwest-1-CODE', {
	stack: 'playground',
	stage: 'CODE',
	env: { region: 'eu-west-1' },
	buildIdentifier: 'ABC',
});
