# What happens when deploying a 'good' build when the service is already partially scaled up?

In this test we went from [application version](../dist) `ABC` to `XYZ` in the stack:
- [`ScalingAsgRollingUpdate`](../packages/cdk/lib/scaling-asg-rolling-update.ts) (CFN stack `playground-CODE-scaling-asg-rolling-update`)

The main aim of this test was to establish whether deploying whilst a service is partially scaled up works as desired.

## Highlights

The current implementation leads to a temporary scale down during deployment; this is undesirable!

I think this could be resolved if we (Riff-Raff?) injected the desired capacity at the start of the deployment [here](https://github.com/guardian/cdk/blob/00ef0467d7797629015f088f969e2bcdab472046/src/experimental/patterns/ec2-app.ts#L50),
instead of the current solution which defaults to the minimum capacity.

## Timeline

1. [Build number 79 was deployed](https://riffraff.gutools.co.uk/deployment/view/322bf36b-fd4d-4fe4-bf72-ce56bb789a08) (in order to start the test from a clean state - running build `ABC`)
2. Artificial traffic was sent to `https://scaling.rolling-update.gutools.co.uk/healthcheck` in order to trigger a scale-up event
3. The service scales up to 6 instances (from 3)
4. [Build number 80 was deployed](https://riffraff.gutools.co.uk/deployment/view/da3d810c-d055-4765-9602-141233e82b45) (which updates to build `XYZ`)
5. The CFN stack `playground-CODE-scaling-asg-rolling-update` started updating:

   First:
   > Rolling update initiated. Terminating 6 obsolete instance(s) in batches of 6, while keeping at least 3 instance(s) in service. Waiting on resource signals with a timeout of PT5M when new instances are added to the autoscaling group.
   
   Then the ASG capacity is updated:
   > Temporarily setting autoscaling group MinSize and DesiredCapacity to 9.
   > 
7. Once three `SUCCESS` signals are received, six instances are terminated.
8. Three more new instances are launched.
9. Once three more `SUCCESS` signals are received, the deployment completes.

Unfortunately this means that the deployment causes us to temporarily run with 3 instances serving traffic when we really need 6 to cope with the load
(see [healthy hosts panel](https://metrics.gutools.co.uk/goto/Tt1IPB3SR?orgId=1)).

Full details can be seen in the [dashboard](https://metrics.gutools.co.uk/d/cdvsv1d6vhp1cb/testing-asg-rolling-update?orgId=1&from=1725025200000&to=1725026399000&var-App=scaling).
