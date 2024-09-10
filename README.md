# Testing ASG Rolling Update

## What is this repository for?
Our current CD platform, Riff-Raff, deploys autoscaling groups (ASG) in the following way:
1. Upload new application artifact
2. Check the load balancer (LB) and ASG report the same number of healthy instances
3. Suspend alarms
4. Double the ASG's desired capacity, launching new instances
5. Wait for the new instances to report healthy; they will be running the new version of application from step 1.
6. Request old instances are terminated
7. Resume alarm notifications

This strategy means between steps 3 and 6 (inclusive) a service will be unable to scale out.
See also https://github.com/guardian/riff-raff/issues/1342.

This repository is used to understand the behaviour of [`AutoScalingRollingUpdate` policy](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-attribute-updatepolicy.html#cfn-attributes-updatepolicy-rollingupdate).
Specifically, if it enables services to scale _during_ deployment.

> [!TIP]
> A dashboard combining CloudFormation events, ASG activity and ASG metrics is available here - https://metrics.gutools.co.uk/d/cdvsv1d6vhp1cb/testing-asg-rolling-update.

## Summary
### Does `AutoScalingRollingUpdate` enable scaling events during deployment?
No.

When `AutoScalingRollingUpdate` is used, the CloudFormation update will remain in the `UPDATE_IN_PROGRESS` state 
until the correct number of `SUCCESS` signals have been received.

If more `SUCCESS` signals are received (due to a scale-out mid-deployment) the CloudFormation update will happily continue.

If fewer `SUCCESS` signals are received (due to a scale-in mid-deployment) the CloudFormation update _could_ fail.
There is no guarantee which instance will be terminated, with the the docs stating:

> Amazon EC2 Auto Scaling features such as instance maintenance policies, termination policies, 
> and scale-in protection are not available for use with CloudFormation rolling updates. 
> Plan your rolling updates accordingly.
> 
> – https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-attribute-updatepolicy.html#cfn-attributes-updatepolicy-rollingupdate

If a newly launched instance is terminated, the CloudFormation update will never receive the required amount of `SUCCESS` signals and a rollback will begin.

For this reason, we recommend suspending the `AlarmNotification` process when using `AutoScalingRollingUpdate`,
else availability of a service cannot be guaranteed.

### Can `AutoScalingRollingUpdate` be used to deploy updates to an autoscaling group?
Yes.

We should use `AutoScalingRollingUpdate` in place of the custom logic of Riff-Raff's `autoscaling` deployment type.

`AutoScalingRollingUpdate` offers an improved DX for failed deployments.
Currently if a Riff-Raff `autoscaling` deployment fails, the capacity of the ASG is not reset.
This means before Riff-Raff can attempt to deploy again, 
the ASGs capacity needs to be [manually fixed](https://github.com/guardian/riff-raff/blob/555e8e36b806cd96a0cc997f993a930d0f640a19/riff-raff/public/docs/howto/fix-a-failed-deploy.md).

If a deployment fails using `AutoScalingRollingUpdate` it is automatically rolled back.
The service can end in an over-capacity state, however this can be mitigated by setting the desired capacity, or with scale-in events.

### What configuration should be used?
The `AutoScalingRollingUpdate` policy has various [properties that can be set](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-attribute-updatepolicy.html#cfn-attributes-updatepolicy-rollingupdate).

If not using horizontal scaling, `AutoScalingRollingUpdate` can be used with any configuration.

If using horizontal scaling, `AutoScalingRollingUpdate` can be used with a variable `MinInstancesInService` property.
Whilst this will result in a slower deployment, `AutoScalingRollingUpdate` enables deployment in some scaled-up scenarios that Riff-Raff currently fails to support,
as the `autoscaling` deployment type fails if there isn't enough head room to launch enough instances (i.e, desired * 2 > max).

From our testing, we recommend the default configuration to be:
- `MaxBatchSize` set to the max capacity of the autoscaling group
- `MinActiveInstancesPercent` set to 100
- `MinInstancesInService` conditionally set (see below)
- `MinSuccessfulInstancesPercent` set to 100
- `PauseTime` set to 5 minutes (the AWS default)
- `SuspendProcesses` set to `AlarmNotification` to prevent scale out/in events and `AutoScalingRollingUpdate` from competing to set the desired capacity
- `WaitOnResourceSignals` set to `true`

> [!NOTE]
> These will be encoded into an [upcoming version of GuCDK](https://github.com/guardian/cdk/pull/2417).

#### `MinInstancesInService`
This is described as:

> Specifies the minimum number of instances that must be in service within the Auto Scaling group while CloudFormation updates old instances.
> 
> – https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-attribute-updatepolicy.html#cfn-attributes-updatepolicy-rollingupdate-mininstancesinservice

Typically, this should be set to the min capacity of the autoscaling group.
For a service that doesn't horizontally scale, and that has max = min * 2, this results in very similar behaviour to Riff-Raff of "double the ASG, then halve it once healthy".

For a service that does horizontally scale, the value of `MinInstancesInService` depends on the current state:
- If the service is running at "normal" capacity (e.g. desired = min), then `MinInstancesInService` can be set to match min.
- If the service is partially scaled, then `MinInstancesInService` should be set to match the current desired capacity.
- If the service is fully scaled, then `MinInstancesInService` should be set to (at least) max -1.

It's worth noting that where `MinInstancesInService` does not match min, the deployment duration becomes variable.
When partially scaled, we won't necessarily be able to achieve the "double the ASG, then halve it once healthy"; instances will be replaced in batches.
When fully scaled, we'd operate a slow "one out, one in" deployment.

It is also worth noting that this property does not consider the healthy host count of the load balancer.
Consequently, during deployment of a fully scaled service, there will be moments when we'll be under-capacity waiting for an instance to come into service.
In this scenario, it is likely that we underestimated the scaling needs of the service, and we should revise the max capacity.
That is, operating at max capacity should be a rare and infrequent scenario.

To support this dynamic property, services that horizontally scale should expose a CloudFormation parameter for Riff-Raff to set during deployment.

#### Autoscaling group desired capacity
If a deployment fails, the desired capacity is not reset to its original value if its not in the CloudFormation template.
Therefore it is possible to end at over-capacity.

If a service implements horizontal scaling, then a scale-in event will eventually right-size the capacity. 

If a service does not implement horizontal scaling, we'd require the desired capacity to be manually reset.
Whilst this is how deployments via Riff-Raff currently work, it's prone to human error.
Therefore it's recommended that Desired is set within the CloudFormation template.

> [!TIP]
> Check the [observations](./observations) directory to learn about our findings during each test.

## How were tests performed?
The tests performed look to cover permutations of:
- Healthcheck passing/failing
- Scale out during deployment
- Scaled to maximum
- Partially scaled where max > min * 2 and min < desired < max
- Scale in during deployment
- Desired set in template/unset in template

During each test, we'll be observing the CloudFormation event log, the ASG activity history and the ASG metrics.

To make these easier to search, a separate CloudFormation stack is created for each scenario.

The following CFN stacks are available in the [Developer Playground account](https://janus.gutools.co.uk/console?permissionId=developerPlayground-dev&tzOffset=1):
- `playground-CODE-basic-asg-rolling-update` created from [basic-asg-rolling-update.ts](./packages/cdk/lib/basic-asg-rolling-update.ts), accessed via https://basic.rolling-update.gutools.co.uk/tags
- `playground-CODE-no-desired-asg-rolling-update` created from [no-desired-asg-rolling-update.ts](./packages/cdk/lib/no-desired-asg-rolling-update.ts), accessed via https://no-desired.rolling-update.gutools.co.uk/tags
- `playground-CODE-scaling-asg-rolling-update` created from [scaling-asg-rolling-update.ts](./packages/cdk/lib/scaling-asg-rolling-update.ts), accessed via https://scaling.rolling-update.gutools.co.uk/tags

> [!TIP]
> See [CONTRIBUTING.md](./CONTRIBUTING.md) for details on adding a new CloudFormation stack.
