# Testing ASG Rolling Update

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

The tests performed look to cover permutations of:
- Healthcheck passing/failing
- Scale out during deployment
- Scaled to maximum
- Partially scaled where max > min * 2 and min < desired < max
- Scale in during deployment
- Desired set in template/unset in template

During each test, we'll be observing the CloudFormation event log, the ASG activity history and the ASG metrics.

To make these easier to search, a separate CloudFormation stack is created for each scenario.

> [!TIP]
> See [CONTRIBUTING.md](./CONTRIBUTING.md) for details on adding a new CloudFormation stack.
