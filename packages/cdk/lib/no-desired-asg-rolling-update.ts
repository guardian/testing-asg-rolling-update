import { AccessScope } from '@guardian/cdk/lib/constants';
import { GuStack } from '@guardian/cdk/lib/constructs/core';
import { GuCname } from '@guardian/cdk/lib/constructs/dns';
import { GuEc2AppExperimental } from '@guardian/cdk/lib/experimental/patterns/ec2-app';
import type { App } from 'aws-cdk-lib';
import { Duration, Tags } from 'aws-cdk-lib';
import type { CfnAutoScalingGroup } from 'aws-cdk-lib/aws-autoscaling';
import { InstanceClass, InstanceSize, InstanceType } from 'aws-cdk-lib/aws-ec2';

interface NoDesiredAsgRollingUpdateProps {
	buildIdentifier: 'ABC' | 'XYZ' | '500';
}

export class NoDesiredAsgRollingUpdate extends GuStack {
	constructor(scope: App, props: NoDesiredAsgRollingUpdateProps) {
		const { buildIdentifier } = props;

		const app = 'no-desired';
		const domainName = `${app}.rolling-update.gutools.co.uk`;
		const filename = `testing-asg-rolling-update_${buildIdentifier}.deb`;

		super(scope, app, {
			stack: 'playground',
			stage: 'CODE',
			app,
			env: {
				region: 'eu-west-1',
			},
		});

		const { loadBalancer, autoScalingGroup } = new GuEc2AppExperimental(this, {
			applicationPort: 9000,
			app,
			instanceType: InstanceType.of(InstanceClass.T4G, InstanceSize.MICRO),
			access: { scope: AccessScope.PUBLIC },
			userData: {
				distributable: {
					fileName: filename,
					executionStatement: `dpkg -i /${app}/${filename}`,
				},
			},
			certificateProps: {
				domainName,
			},
			monitoringConfiguration: { noMonitoring: true },
			scaling: {
				minimumInstances: 3,
			},
			applicationLogging: {
				enabled: true,
				systemdUnitName: app,
			},
			imageRecipe: 'developerPlayground-arm64-java11',
		});

		// The pre-built application debian file's service name is `testing-asg-rolling-update`.
		// Overwrite this tag, which GuCDK sets as the `app` value, so logs are shipped.
		Tags.of(autoScalingGroup).add(
			'SystemdUnit',
			'testing-asg-rolling-update.service',
		);

		const cfnAsg = autoScalingGroup.node.defaultChild as CfnAutoScalingGroup;
		cfnAsg.desiredCapacity = undefined;

		new GuCname(this, 'DNS', {
			app,
			ttl: Duration.hours(1),
			domainName,
			resourceRecord: loadBalancer.loadBalancerDnsName,
		});
	}
}
