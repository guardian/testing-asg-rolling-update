import 'source-map-support/register';

import { RiffRaffYamlFile } from '@guardian/cdk/lib/riff-raff-yaml-file';
import { App } from 'aws-cdk-lib';
import { BasicAsgRollingUpdate } from '../lib/basic-asg-rolling-update';
import { EventForwarder } from '../lib/event-forwarder';
import { NoDesiredAsgRollingUpdate } from '../lib/no-desired-asg-rolling-update';
import { ScalingAsgRollingUpdate } from '../lib/scaling-asg-rolling-update';

const app = new App();

const eventForwarder = new EventForwarder(app);

[
	new BasicAsgRollingUpdate(app, {
		buildIdentifier: '500',
	}),

	new NoDesiredAsgRollingUpdate(app, {
		buildIdentifier: '500',
	}),

	new ScalingAsgRollingUpdate(app, {
		buildIdentifier: '500',
	}),
].forEach((_) => {
	// Configure Riff-Raff to deploy each application stack after the EventForwarder stack has finished.
	_.addDependency(eventForwarder);
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
