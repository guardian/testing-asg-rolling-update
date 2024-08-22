import { AccessScope } from '@guardian/cdk/lib/constants';
import type { GuStackProps } from '@guardian/cdk/lib/constructs/core';
import { GuStack } from '@guardian/cdk/lib/constructs/core';
import { GuCname } from '@guardian/cdk/lib/constructs/dns';
import { GuEc2AppExperimental } from '@guardian/cdk/lib/experimental/patterns/ec2-app';
import type { App } from 'aws-cdk-lib';
import { Duration, Tags } from 'aws-cdk-lib';
import { InstanceClass, InstanceSize, InstanceType } from 'aws-cdk-lib/aws-ec2';

interface TestingAsgRollingUpdateProps extends GuStackProps {
	app: string;
	buildIdentifier: 'ABC' | 'XYZ' | '500';
}

export class TestingAsgRollingUpdate extends GuStack {
	constructor(scope: App, id: string, props: TestingAsgRollingUpdateProps) {
		super(scope, id, props);

		const { app, buildIdentifier } = props;

		const domainName = `${app}.code.dev-gutools.co.uk`;

		const { loadBalancer, autoScalingGroup } = new GuEc2AppExperimental(this, {
			applicationPort: 9000,
			app,
			instanceType: InstanceType.of(InstanceClass.T4G, InstanceSize.MICRO),
			access: { scope: AccessScope.PUBLIC },
			userData: {
				distributable: {
					fileName: `${app}_${buildIdentifier}.deb`,
					executionStatement: `dpkg -i /${app}/${app}_${buildIdentifier}.deb`,
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

		const { GITHUB_RUN_NUMBER = 'unknown', GITHUB_SHA = 'unknown' } =
			process.env;

		this.addMetadata('gu:build:number', GITHUB_RUN_NUMBER);
		this.addMetadata('gu:build:sha', GITHUB_SHA);

		Tags.of(autoScalingGroup).add('gu:build:number', GITHUB_RUN_NUMBER);
		Tags.of(autoScalingGroup).add('gu:build:sha', GITHUB_SHA);
	}
}
