# What happens when deploying a 'bad' build when the service is already fully scaled up?

In this test we went from [application version](../dist) `ABC` to `500` in the stack:
- [`ScalingAsgRollingUpdate`](../packages/cdk/lib/scaling-asg-rolling-update.ts) (CFN stack `playground-CODE-scaling-asg-rolling-update`).

In response to a [previous version of this test](healthy-to-healthy-fully-scaled.md), we also injected the current
desired capacity (minus 1) as the value for the
[`MinInstancesInService`](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-attribute-updatepolicy.html#cfn-attributes-updatepolicy-rollingupdate-mininstancesinservice)
property before starting the rolling update.

The main aim of this test was to establish whether the behaviour is acceptable when a broken build is deployed while
a service is fully scaled up.

## Highlights

Generally the failure is handled gracefully and there should be minimal impact on end users; there will be 1 less
instance capable of serving requests until the automated rollback is triggered.

At the end of the deployment the service is left correctly provisioned.

## Timeline

1. [Build number 121 was deployed](https://riffraff.gutools.co.uk/deployment/view/62a632c9-3f9f-4c50-a1d5-6430af2eb03e)
   to start from a known state, running artifact `ABC`

   The ASG starts with a capacity of:

   | Capacity | Value |
   |----------|-------|
   | Min      | 3     |
   | Desired  | 3     |
   | Max      | 9     |

2. The service was manually scaled up by invoking our `scale-out` script 6 times.

   The ASG capacities are now:

   | Capacity | Value |
   |----------|-------|
   | Min      | 3     |
   | Desired  | 9     |
   | Max      | 9     |

   There are 9 instances capable of serving requests (all running `ABC`).

3. [Build number 127 was deployed](https://riffraff.gutools.co.uk/deployment/view/af9f4560-7ed0-46ea-96a3-17b42aaa87d9).
   This updates to use artifact `500` _and_ [sets `MinInstancesInService` to 8](https://github.com/guardian/testing-asg-rolling-update/compare/main...jw-min-8-500).

4. The CFN stack `playground-CODE-scaling-asg-rolling-update` begins to update the ASG. 

    > Rolling update initiated. Terminating 9 obsolete instance(s) in batches of 1, while keeping at least 8 instance(s) in service.

    Note that, unlike in other scenarios, the ASG capacities are never modified:

    | Capacity | Value |
    |----------|-------|
    | Min      | 3     |
    | Desired  | 9     |
    | Max      | 9     |

5. AWS waits exactly 5-minutes for the new instance to come into service (this will never happen because the healthcheck
   is intentionally broken):

    > Failed to receive 1 resource signal(s) for the current batch.  Each resource signal timeout is counted as a FAILURE. 
    > Received 0 SUCCESS signal(s) out of 9.  Unable to satisfy 100% MinSuccessfulInstancesPercent requirement

   During this 5-minute period there are 8 instances capable of serving requests (all running `ABC`). This is one fewer
   than before the deployment started, so it may have an impact on performance.

6. The rollback starts:

   > Rolling update initiated. Terminating 1 obsolete instance(s) in batches of 1, while keeping at least 3 instance(s) in service.

   And the instance running `500` is terminated and replaced with an instances running `ABC`:

   > Terminating instance(s) [i-033173ed110ee20c6]; replacing with 1 new instance(s).

7. Once the instance running `ABC` sends its `SUCCESS` signal, the rollback completes.

   At the end of the deployment the ASG capacities are correct (i.e. the same as before the deployment started):

    | Capacity | Value |
    |----------|-------|
    | Min      | 3     |
    | Desired  | 9     |
    | Max      | 9     |

    There are now 9 instances capable of serving requests again (all running `ABC`).

Full details can be seen via [the dashboard](https://metrics.gutools.co.uk/goto/mK9IGM6SR?orgId=1).