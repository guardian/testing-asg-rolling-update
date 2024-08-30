# What happens when deploying a 'good' build (without scaling events)?

In this test we went from [application version](../dist) `ABC` to `XYZ` in the stacks:
- [`BasicAsgRollingUpdate`](../packages/cdk/lib/basic-asg-rolling-update.ts) (CFN stack `playground-CODE-basic-asg-rolling-update`)
- [`NoDesiredAsgRollingUpdate`](../packages/cdk/lib/no-desired-asg-rolling-update.ts) (CFN stack `playground-CODE-no-desired-asg-rolling-update`)

The main aim of this test was to establish whether setting desired capacity in the CloudFormation template is
necessary for 'typical' deployments like this one.

## Highlights

The deployment works correctly, regardless of whether a desired capacity is specified in the CloudFormation template or not.

## Timeline

1. [Build number 70 was deployed](https://riffraff.gutools.co.uk/deployment/view/4b79bd15-eddc-4563-8226-8253fdd98c8c) (in order to start the test from a clean state - running build `ABC`)
2. [Build number 71 was deployed](https://riffraff.gutools.co.uk/deployment/view/be31cc20-6875-44b6-8971-7e7e81bb7bd5) (which updates to build `XYZ`)
3. The CFN stacks `playground-CODE-basic-asg-rolling-update` and `playground-CODE-no-desired-asg-rolling-update` started updating.

    First:
    > Rolling update initiated. Terminating 5 obsolete instance(s) in batches of 5, while keeping at least 5 instance(s) in service.
   
    Then the ASG capacity is updated:
    > Temporarily setting autoscaling group MinSize and DesiredCapacity to 10.
4. Five `SUCCESS` signals are received, so the rolling update terminates the old instances:

   `playground-CODE-basic-asg-rolling-update`:
    > Terminating instance(s) [i-05c3716abc787c0e7,i-07fa3ab24b8a2aafc,i-05a6bbbf3604d1c6d,i-0975853c6e1954e88,i-0dcdb5cb3ac8f57e8]; replacing with 0 new instance(s).

   `playground-CODE-no-desired-asg-rolling-update`:
    > Terminating instance(s) [i-05295af2f22bdf44a,i-0403a4e9895af9501,i-0bc968da49c888bc0,i-0facecc42865756b3,i-0f2d675b80d750756]; replacing with 0 new instance(s).
   
5. Once the old instances are terminated the update completes:

   `playground-CODE-no-desired-asg-rolling-update`:
   > Successfully terminated instance(s) [i-05c3716abc787c0e7,i-07fa3ab24b8a2aafc,i-05a6bbbf3604d1c6d,i-0975853c6e1954e88,i-0dcdb5cb3ac8f57e8] (Progress 100%).

   `playground-CODE-no-desired-asg-rolling-update`: 
   > Successfully terminated instance(s) [i-05295af2f22bdf44a,i-0403a4e9895af9501,i-0bc968da49c888bc0,i-0facecc42865756b3,i-0f2d675b80d750756] (Progress 100%).

   CloudTrail shows that the `AWSCloudFormation` user is making a `TerminateInstanceInAutoScalingGroup` API call with `shouldDecrementDesiredCapacity` set to `true` for _both_ ASGs[^1]. 


6. Both stacks have the correct number of instances after the deployment (5).

Full details for both stacks can be seen in the dashboard (for [`basic`](https://metrics.gutools.co.uk/d/cdvsv1d6vhp1cb/testing-asg-rolling-update?orgId=1&from=1724769840000&to=1724770319000&var-App=basic) and [`no-desired`]([https://metrics.gutools.co.uk/goto/GUQvzBqIg?orgId=1](https://metrics.gutools.co.uk/d/cdvsv1d6vhp1cb/testing-asg-rolling-update?orgId=1&from=1724769840000&to=1724770319000&var-App=no-desired))).

[^1]: There is also an explicit `SetDesiredCapacity` API call in both cases, which seems unnecessary.
    
