import { AccessScope } from '@guardian/cdk/lib/constants';
import { GuStack } from '@guardian/cdk/lib/constructs/core';
import { GuCname } from '@guardian/cdk/lib/constructs/dns';
import { GuEc2AppExperimental } from '@guardian/cdk/lib/experimental/patterns/ec2-app';
import type { App } from 'aws-cdk-lib';
import { Duration } from 'aws-cdk-lib';
import { InstanceClass, InstanceSize, InstanceType } from 'aws-cdk-lib/aws-ec2';

interface BasicAsgRollingUpdateProps {
	buildIdentifier: 'ABC' | 'XYZ' | '500';
}

export class BasicAsgRollingUpdate extends GuStack {
	constructor(scope: App, props: BasicAsgRollingUpdateProps) {
		const { buildIdentifier } = props;

		const app = 'basic';
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

		const { loadBalancer } = new GuEc2AppExperimental(this, {
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
				minimumInstances: 5,
			},
			applicationLogging: {
				enabled: true,
				systemdUnitName: app,
			},
			imageRecipe: 'developerPlayground-arm64-java11',
		});

		new GuCname(this, 'DNS', {
			app,
			ttl: Duration.hours(1),
			domainName,
			resourceRecord: loadBalancer.loadBalancerDnsName,
		});
	}
}
