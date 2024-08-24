import { GuStack } from '@guardian/cdk/lib/constructs/core';
import { GuLambdaFunction } from '@guardian/cdk/lib/constructs/lambda';
import type { App } from 'aws-cdk-lib';
import { Arn } from 'aws-cdk-lib';
import { Rule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import { LoggingFormat, Runtime } from 'aws-cdk-lib/aws-lambda';

export class EventForwarder extends GuStack {
	constructor(scope: App) {
		const app = 'event-forwarder';

		super(scope, 'EventForwarder', {
			stack: 'playground',
			stage: 'CODE',
			app,
			env: {
				region: 'eu-west-1',
			},
		});

		const { account, region } = this;

		const lambda = new GuLambdaFunction(this, 'EventForwarderLambda', {
			app,
			fileName: `${app}.zip`,
			handler: 'index.main',
			runtime: Runtime.NODEJS_20_X,

			/*
			Override the default provided by GuCDK for improved compatability with https://github.com/guardian/cloudwatch-logs-management when producing log lines with markers.
			See also: https://github.com/guardian/cloudwatch-logs-management/issues/326.
			 */
			loggingFormat: LoggingFormat.TEXT,
		});

		new Rule(this, 'CloudformationEventForwarderRule', {
			targets: [new LambdaFunction(lambda)],
			eventPattern: {
				source: ['aws.cloudformation'],
				detailType: ['CloudFormation Resource Status Change'],
				detail: {
					'stack-id': [
						{
							wildcard: Arn.format({
								partition: 'aws',
								service: 'cloudformation',
								region,
								account,
								resource: 'stack',
								resourceName: 'playground-CODE-*-asg-rolling-update/*',
							}),
						},
					],
				},
			},
		});

		new Rule(this, 'AutoscalingGroupEventForwarderRule', {
			targets: [new LambdaFunction(lambda)],
			eventPattern: {
				source: ['aws.autoscaling'],
				detail: {
					AutoScalingGroupName: [
						{
							wildcard: 'playground-CODE-*-asg-rolling-update-*',
						},
					],
				},
			},
		});
	}
}
