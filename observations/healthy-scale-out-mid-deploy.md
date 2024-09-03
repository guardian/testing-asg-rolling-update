# What happens when a scale-out event occurs mid-deployment?

In this test we deployed [application version](../dist) `ABC` to `XYZ` in the stack 
[`ScalingAsgRollingUpdate`](../packages/cdk/lib/scaling-asg-rolling-update.ts) (CFN stack `playground-CODE-scaling-asg-rolling-update`).

The aim of this test is to understand the behaviour in the ["Ophan scenario"](https://github.com/guardian/riff-raff/issues/1342).

## Highlights
The deployment leaves the service under-capacity.

> [!TIP]
> Full details can be seen in [the dashboard](https://metrics.gutools.co.uk/d/cdvsv1d6vhp1cb/testing-asg-rolling-update?orgId=1&from=1725344340000&to=1725344705000&var-App=scaling).

## Timeline
1. [Build number 98 was deployed](https://riffraff.gutools.co.uk/deployment/view/60d5b8d1-3535-4948-a096-adf924c8ee43) to start from a clean slate, running artifact `ABC`
2. [Build number 100 was deployed](https://riffraff.gutools.co.uk/deployment/view/49d4a159-0c64-4594-a95b-b9bd12205aa6) updating to use artifact `XYZ`
3. The CFN stack `playground-CODE-scaling-asg-rolling-update` begins to update the ASG, setting the min and desired to 6:

   > Temporarily setting autoscaling group MinSize and DesiredCapacity to 6.
   
   Consequently, the ASG now has a capacity of:
   
   | Capacity | Value |
   |----------|-------|
   | Min      | 6     |
   | Desired  | 6     |
   | Max      | 9     |

4. The [`scale-out` script](../script/scale-out) was executed twice, setting the desired from 6 to 7, then 7 to 8:

   > At 2024-09-03T06:22:07Z a user request executed policy playground-CODE-scaling-asg-rolling-update-ScaleOut-hhE4chjHHTWQ changing the desired capacity from 7 to 8. 
   > At 2024-09-03T06:22:15Z an instance was started in response to a difference between desired and actual capacity, increasing the capacity from 7 to 8.

   The ASG now has a capacity of:

   | Capacity | Value |
   |----------|-------|
   | Min      | 6     |
   | Desired  | 8     |
   | Max      | 9     |

5. CloudFormation received `SUCCESS` signals and proceeds to terminate the old instances, and also alter the ASG capacity.

   From the ASG activity:
   > At 2024-09-03T06:23:23Z a user request update of AutoScalingGroup constraints to min: 3, max: 9, desired: 6 changing the desired capacity from 8 to 6.
   > At 2024-09-03T06:23:29Z an instance was taken out of service in response to a difference between desired and actual capacity, shrinking the capacity from 5 to 3.
   > At 2024-09-03T06:23:29Z instance i-0220958315f410f0b was selected for termination. 
   > At 2024-09-03T06:23:29Z instance i-02b01e80c9a3a6d99 was selected for termination.

   Curiously, CloudFormation has not acknowledged the updated capacity from step 4.
6. The CloudFormation update finishes, and the final capacity of the ASG is:

   | Capacity | Value |
   |----------|-------|
   | Min      | 3     |
   | Desired  | 3     |
   | Max      | 9     |

   This is under-capacity, as the scale-in event has not yet occurred.

   Once the scale-out alarm is evaluated, the ASG capacity will be updated. 
