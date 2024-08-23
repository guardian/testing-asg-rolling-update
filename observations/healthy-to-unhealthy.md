# What happens when deploying a failing healthcheck?

In this test we went from [application version](../dist) `ABC` to `500` in the stacks:
- [`BasicAsgRollingUpdate`](../lib/basic-asg-rolling-update.ts) (CFN stack `playground-CODE-basic-asg-rolling-update`)
- [`NoDesiredAsgRollingUpdate`](../lib/no-desired-asg-rolling-update.ts) (CFN stack `playground-CODE-no-desired-asg-rolling-update`)

## Highlights
The ASG should have an explicit desired capacity. 

If the desired capacity is not explicitly provided, deploying a failing healthcheck results in an over-capacity service. 

## Timeline
1. [Build number 24 was deployed](https://riffraff.gutools.co.uk/deployment/view/18a7a3b3-1941-4358-a452-612c0bfae35a)
2. The CFN stacks `playground-CODE-basic-asg-rolling-update` and `playground-CODE-no-desired-asg-rolling-update` started updating.
    
    First:
    > Rolling update initiated. Terminating 5 obsolete instance(s) in batches of 5, while keeping at least 5 instance(s) in service. 
    > Waiting on resource signals with a timeout of PT5M when new instances are added to the autoscaling group.

    Then the ASG capacity is updated:
    > Temporarily setting autoscaling group MinSize and DesiredCapacity to 10.
3. No successful signals are received and CloudFormation moves to `UPDATE_FAILED`, then `UPDATE_ROLLBACK_IN_PROGRESS`.
    
    - In the `playground-CODE-basic-asg-rolling-update` stack, the ASG capacity rolls back to Min=5, Desired=5, Max=10.
    - In the `playground-CODE-no-desired-asg-rolling-update` stack, the ASG capacity rolls back to Min=5, Max=10. The Desired is not rolled back, remaining at 10 from step 2.
4. Once the CFN stacks enter `UPDATE_ROLLBACK_COMPLETE`, the deployment has finished.

   - In the `playground-CODE-basic-asg-rolling-update` stack, there are 5 instances running artifact `ABC`.
   - In the `playground-CODE-no-desired-asg-rolling-update` stack, there are 10 instances running artifact `ABC`. This is over-capacity.
