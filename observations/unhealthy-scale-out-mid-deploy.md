# What happens when a scale-out event occurs mid-deployment of an unhealthy artifact?

In this test we deployed [application version](../dist) `ABC` to `500` in the stack
[`ScalingAsgRollingUpdate`](../packages/cdk/lib/scaling-asg-rolling-update.ts) (CFN stack `playground-CODE-scaling-asg-rolling-update`).

The aim of this test is to understand the behaviour in the ["Ophan scenario"](https://github.com/guardian/riff-raff/issues/1342).

## Highlights
The deployment leaves the service over-capacity.

> [!TIP]
> Full details can be seen in [the dashboard](https://metrics.gutools.co.uk/d/cdvsv1d6vhp1cb/testing-asg-rolling-update?orgId=1&from=1725346500000&to=1725347100000&var-App=scaling).

## Timeline
1. [Build number 98 was deployed](https://riffraff.gutools.co.uk/deployment/view/b74ca6b1-8c76-4189-89c1-5b8e480b72e9) to start from a clean slate, running artifact `ABC`
2. [Build number 99 was deployed](https://riffraff.gutools.co.uk/deployment/view/273d3784-88a9-4445-9948-91fc0e1af389) updating to use artifact `500`
3. The CFN stack `playground-CODE-scaling-asg-rolling-update` begins to update the ASG, setting the min and desired to 6:

   From the CFN events:
   > Temporarily setting autoscaling group MinSize and DesiredCapacity to 6.

   Consequently, the ASG now has a capacity of:

   | Capacity | Value |
   |----------|-------|
   | Min      | 6     |
   | Desired  | 6     |
   | Max      | 9     |

4. The [`scale-out` script](../script/scale-out) was executed twice, setting the desired from 6 to 7, then 7 to 8.
   The ASG launches two new instances with the updated (broken) launch template. 

   From the ASG activity:
   > At 2024-09-03T06:56:23Z a user request executed policy playground-CODE-scaling-asg-rolling-update-ScaleOut-hhE4chjHHTWQ changing the desired capacity from 7 to 8.
   > At 2024-09-03T06:56:31Z an instance was started in response to a difference between desired and actual capacity, increasing the capacity from 7 to 8.

   The ASG now has a capacity of:

   | Capacity | Value |
   |----------|-------|
   | Min      | 6     |
   | Desired  | 8     |
   | Max      | 9     |
5. CloudFormation does not receive any `SUCCESS` signals, and proceeds to rollback.

   From the CFN events:
   > Rolling update initiated. 
   > Terminating 5 obsolete instance(s) in batches of 5, while keeping at least 3 instance(s) in service. 
   > Waiting on resource signals with a timeout of PT5M when new instances are added to the autoscaling group.
6. CloudFormation has rolled back the launch template and now proceeds to launch new instances:

   From the CFN events:
   > New instance(s) added to autoscaling group - Waiting on 5 resource signal(s) with a timeout of PT5M.

   From the ASG activity:
   > At 2024-09-03T07:01:15Z an instance was started in response to a difference between desired and actual capacity, increasing the capacity from 3 to 8.
7. The CloudFormation rollback completes, and the final capacity of the ASG is:

   | Capacity | Value |
   |----------|-------|
   | Min      | 3     |
   | Desired  | 8     |
   | Max      | 9     |

   This is at (scaled out) capacity. The instances are running artifact `ABC`.

   It is worth noting that the target group, expectedly, has eight healthy hosts only at this stage. 
