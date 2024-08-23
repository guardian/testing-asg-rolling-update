import 'source-map-support/register';

import { RiffRaffYamlFile } from '@guardian/cdk/lib/riff-raff-yaml-file';
import { App } from 'aws-cdk-lib';
import { BasicAsgRollingUpdate } from '../lib/basic-asg-rolling-update';
import { NoDesiredAsgRollingUpdate } from '../lib/no-desired-asg-rolling-update';

const app = new App();

new BasicAsgRollingUpdate(app, {
	buildIdentifier: '500',
});

new NoDesiredAsgRollingUpdate(app, {
	buildIdentifier: '500',
});

/*
Set every `autoscaling / uploadArtifacts` deployment to use the same `contentDirectory`
allowing us to create multiple stacks w/out needing to edit `.github/workflows/ci.yaml`.
 */
const riffRaff = new RiffRaffYamlFile(app);
const { deployments } = riffRaff.riffRaffYaml;
deployments.forEach((value, key) => {
	const { type, actions = [] } = value;
	const [action] = actions;
	if (type === 'autoscaling' && action === 'uploadArtifacts') {
		deployments.set(key, {
			...value,
			contentDirectory: 'testing-asg-rolling-update',
		});
	}
});
riffRaff.synth();
