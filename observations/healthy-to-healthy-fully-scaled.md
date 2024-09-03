# What happens when deploying a 'good' build when the service is already fully scaled up?

In this test we went from [application version](../dist) `ABC` to `XYZ` in the stack:
- [`ScalingAsgRollingUpdate`](../packages/cdk/lib/scaling-asg-rolling-update.ts) (CFN stack `playground-CODE-scaling-asg-rolling-update`)

The main aim of this test was to establish whether deploying whilst a service is fully scaled up works as desired.

## Highlights

The current implementation leads to a temporary scale down during deployment. 

The number of instances that the service will be scaled down by is: `maximumCapacity - minimumCapacity`, so this
could be a significant drop for a service with a high maximum capacity.

## Timeline

1. [Build number 98 was deployed](https://riffraff.gutools.co.uk/deployment/view/d124c461-af75-4bd6-ad14-30f417ee8fad)
(in order to start the test from a clean state - running build `ABC`)
2. The service was scaled up by repeatedly invoking our `scale-out` script. 
3. The service scales up to 9 instances (from 3).
4. [Build number 100 was deployed](https://riffraff.gutools.co.uk/deployment/view/959b7609-4bde-46b8-9c17-93527a8717f4)
(which updates to build `XYZ`)
5. The CFN stack `playground-CODE-scaling-asg-rolling-update` started updating:

    First:
    > Rolling update initiated. Terminating 9 obsolete instance(s) in batches of 6, while keeping at least 3 instance(s) in service.
    > Waiting on resource signals with a timeout of PT5M when new instances are added to the autoscaling group.
   
    Then 6 instances are terminated and 6 new ones are launched:
    > Terminating instance(s) [i-0333b7c2687c1ab46,i-04427ad5d2e5aa426,i-009b2c94810830dc5,i-0357d971d597edbbc,i-087ddecad98eebd05,i-047dbb0efa5bf5123]; replacing with 6 new instance(s).

    _At this point we are under-provisioned by 6 instances._

6. 6 `SUCCESS` signals are received. _At this point we are provisioned correctly again._
7. 3 more instances are terminated and 3 more are launched:

    > Terminating instance(s) [i-07b18ed78618ef26a,i-0f94470f722e91778,i-0dc27b65fc7911afe]; replacing with 3 new instance(s).
   
   _At this point we are under-provisioned by 3 instances._
8. 3 `SUCCESS` signals are received and the deployment completes. _At this point we are provisioned correctly again._

Unfortunately this means that the deployment causes us to temporarily run with 3 instances serving traffic (and later 6 instances)
when we really need 9 to cope with the load (see [healthy hosts panel](https://metrics.gutools.co.uk/goto/-k-R2qqSR?orgId=1)).

Full details can be seen via the [dashboard](https://metrics.gutools.co.uk/goto/SBt6pqqIg?orgId=1).

## Potential Mitigations

See the [potential mitigations described in the partially-scaled scenario](healthy-to-healthy-partially-scaled.md#potential-mitigations), which also apply here.
