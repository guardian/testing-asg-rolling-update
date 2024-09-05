# What happens when deploying a 'bad' build when the service is already partially scaled up?

In this test we went from [application version](../dist) `ABC` to `500` in the stack:
- [`ScalingAsgRollingUpdate`](../packages/cdk/lib/scaling-asg-rolling-update.ts) (CFN stack `playground-CODE-scaling-asg-rolling-update`).

In response to a [previous version of this test](healthy-to-healthy-partially-scaled.md), we also injected the current
desired capacity as the value for the
[`MinInstancesInService`](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-attribute-updatepolicy.html#cfn-attributes-updatepolicy-rollingupdate-mininstancesinservice)
property before starting the rolling update.

The main aim of this test was to establish whether the behaviour is acceptable when a broken build is deployed while
a service is partially scaled up.

## Highlights

Generally the failure is handled gracefully and there should be no impact on end users.

At the end of the deployment the service is left over-provisioned, but this is not problematic in this context as scale-in
alarms should correct this over-provisioning automatically.

## Timeline

1. [Build number 121 was deployed](https://riffraff.gutools.co.uk/deployment/view/8cbb693b-3db5-48f8-a522-4f11c07c20e1)
   to start from a known state, running artifact `ABC`

   The ASG starts with a capacity of:

   | Capacity | Value |
   |----------|-------|
   | Min      | 3     |
   | Desired  | 3     |
   | Max      | 9     |

2. The service was manually scaled up by invoking our `scale-out` script 3 times.

   The ASG capacities are now:

   | Capacity | Value |
   |----------|-------|
   | Min      | 3     |
   | Desired  | 6     |
   | Max      | 9     |

   There are 6 instances capable of serving requests (all running `ABC`).

3. [Build number 126 was deployed](https://riffraff.gutools.co.uk/deployment/view/77ebbd39-8373-4658-9fd6-833518b9d8c9).
   This updates to use artifact `500` _and_ [sets `MinInstancesInService` to 6](https://github.com/guardian/testing-asg-rolling-update/compare/main...jw-min-6-500).

4. The CFN stack `playground-CODE-scaling-asg-rolling-update` begins to update the ASG:

   > Temporarily setting autoscaling group MinSize and DesiredCapacity to 9.

   Consequently, the ASG now has a capacity of:

   | Capacity | Value |
   |----------|-------|
   | Min      | 9     |
   | Desired  | 9     |
   | Max      | 9     |

5. AWS waits exactly 5-minutes for the new instances to come into service (this will never happen because the healthcheck
is intentionally broken):

    > Failed to receive 3 resource signal(s) for the current batch.  Each resource signal timeout is counted as a FAILURE.
    > Received 0 SUCCESS signal(s) out of 6.  Unable to satisfy 100% MinSuccessfulInstancesPercent requirement 

   During this 5-minute period there are still 6 instances capable of serving requests (all running `ABC`).

6. The rollback starts:

    > Rolling update initiated. Terminating 3 obsolete instance(s) in batches of 3, while keeping at least 3 instance(s) in service.

    And the 3 instances running `500` are terminated and replaced with instances running `ABC`:

    > Terminating instance(s) [i-0db270257b1c04b13,i-056b7b3edcd415cf8,i-0f1eba98c21762963]; replacing with 3 new instance(s).

7. Once the instances running `ABC` send their `SUCCESS` signals, the rollback completes.

    At the end of the deployment the ASG capacities are as follows:

   | Capacity | Value |
   |----------|-------|
   | Min      | 3     |
   | Desired  | 9     |
   | Max      | 9     |

    There are now 9 instances capable of serving requests (all running `ABC`).

    Strictly speaking, we only need 6 (`Desired` should be 6, as it was before the deployment started), but we can allow
    the scale-in alarms to fix this for us.

Full details can be seen via [the dashboard](https://metrics.gutools.co.uk/goto/801qgMeIg?orgId=1).