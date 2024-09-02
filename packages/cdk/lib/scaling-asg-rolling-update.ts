import { AccessScope } from '@guardian/cdk/lib/constants';
import { GuStack } from '@guardian/cdk/lib/constructs/core';
import { GuCname } from '@guardian/cdk/lib/constructs/dns';
import { GuEc2AppExperimental } from '@guardian/cdk/lib/experimental/patterns/ec2-app';
import type { App } from 'aws-cdk-lib';
import { CfnOutput, Duration, Tags } from 'aws-cdk-lib';
import type { CfnAutoScalingGroup } from 'aws-cdk-lib/aws-autoscaling';
import { CfnScalingPolicy } from 'aws-cdk-lib/aws-autoscaling';
import { InstanceClass, InstanceSize, InstanceType } from 'aws-cdk-lib/aws-ec2';

interface ScalingAsgRollingUpdateProps {
	buildIdentifier: 'ABC' | 'XYZ' | '500';
}

export class ScalingAsgRollingUpdate extends GuStack {
	constructor(scope: App, props: ScalingAsgRollingUpdateProps) {
		const { buildIdentifier } = props;

		const app = 'scaling';
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
				maximumInstances: 9,
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

		const scaleOutPolicy = new CfnScalingPolicy(this, 'ScaleOut', {
			autoScalingGroupName: autoScalingGroup.autoScalingGroupName,
			policyType: 'SimpleScaling',
			adjustmentType: 'ChangeInCapacity',
			scalingAdjustment: 1,
		});

		const scaleInPolicy = new CfnScalingPolicy(this, 'ScaleIn', {
			autoScalingGroupName: autoScalingGroup.autoScalingGroupName,
			policyType: 'SimpleScaling',
			adjustmentType: 'ChangeInCapacity',
			scalingAdjustment: -1,
		});

		new CfnOutput(this, 'ScaleOutArn', {
			key: 'ScaleOutArn',
			value: scaleOutPolicy.attrArn,
		});

		new CfnOutput(this, 'ScaleInArn', {
			key: 'ScaleInArn',
			value: scaleInPolicy.attrArn,
		});

		new CfnOutput(this, 'AutoscalingGroupName', {
			key: 'AutoscalingGroupName',
			value: autoScalingGroup.autoScalingGroupName,
		});

		const cfnAsg = autoScalingGroup.node.defaultChild as CfnAutoScalingGroup;
		cfnAsg.desiredCapacity = undefined;
		cfnAsg.cfnOptions.updatePolicy = {
			...cfnAsg.cfnOptions.updatePolicy,
			autoScalingRollingUpdate: {
				...cfnAsg.cfnOptions.updatePolicy?.autoScalingRollingUpdate,
				minInstancesInService: 8,
			},
		};

		new GuCname(this, 'DNS', {
			app,
			ttl: Duration.hours(1),
			domainName,
			resourceRecord: loadBalancer.loadBalancerDnsName,
		});
	}
}
