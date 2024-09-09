# What happens when deploying a 'good' build when the service is already partially scaled up?

In this test we went from [application version](../dist) `ABC` to `XYZ` in the stack:
- [`ScalingAsgRollingUpdate`](../packages/cdk/lib/scaling-asg-rolling-update.ts) (CFN stack `playground-CODE-scaling-asg-rolling-update`).

In response to a [previous version of this test](healthy-to-healthy-partially-scaled.md), we also injected the current
desired capacity as the value for the
[`MinInstancesInService`](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-attribute-updatepolicy.html#cfn-attributes-updatepolicy-rollingupdate-mininstancesinservice)
property before starting the rolling update.

The main aim of this test was to establish whether setting `MinInstancesInService` dynamically would allow us to avoid
the undesirable mid-deployment under-provisioning that we noticed when this value was hardcoded.

## Highlights

Setting the `MinInstancesInService` property dynamically allows us to deploy relatively quickly, without increasing the
risk of mid-deployment performance problems.

## Timeline

1. [Build number 116 was deployed](https://riffraff.gutools.co.uk/deployment/view/cdaa893d-dec3-40e8-8252-5be72a441652)
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

3. [Build number 117 was deployed](https://riffraff.gutools.co.uk/deployment/view/a231e031-7187-4ec7-b64e-7afa2cbdb45e).
   This updates to use artifact `XYZ` _and_ [sets `MinInstancesInService` to 6](https://github.com/guardian/testing-asg-rolling-update/compare/main...jw-min-6-xyz).

4. The CFN stack `playground-CODE-scaling-asg-rolling-update` begins to update the ASG:

   > Temporarily setting autoscaling group MinSize and DesiredCapacity to 9.

   Consequently, the ASG now has a capacity of:

   | Capacity | Value |
   |----------|-------|
   | Min      | 9     |
   | Desired  | 9     |
   | Max      | 9     |

   Due to the dynamically set `MinInstancesInService` property, AWS now avoids under-provisioning the service
   during the deployment:
   
   > Rolling update initiated. Terminating 6 obsolete instance(s) in batches of 3, while keeping at least 6 instance(s) in service.

5. Once three `SUCCESS` signals are received, 3 instances are terminated and 3 new ones are launched.

   >  Terminating instance(s) [i-023fbdd4382a9dcd1,i-0005ea168f117bd60,i-08f8bf3b8d8dacdbb]; replacing with 3 new instance(s).

    The ASG still has a capacity of:
    
    | Capacity | Value |
    |----------|-------|
    | Min      | 9     |
    | Desired  | 9     |
    | Max      | 9     |    

   There are 6 instances capable of serving requests (3 running `XYZ` and 3 running `ABC`).

6. The 3 new instances (launched in previous step) send a `SUCCESS` signal and start serving traffic.

    The ASG still has a capacity of:

    | Capacity | Value |
    |----------|-------|
    | Min      | 9     |
    | Desired  | 9     |
    | Max      | 9     |    

    There are (briefly) 9 instances capable of serving requests (6 running `XYZ` and 3 running `ABC`).

7. It is now safe for AWS to terminate the remaining instances running ABC, so it does so:

    > Terminating instance(s) [i-0b455277568a554b5,i-0e92472e453425cb1,i-0dfe47c2a8e53b0b7]; replacing with 0 new instance(s).
   
    The update completes once these instances are terminated.
 
8. The ASG capacities are updated, so we end with the capacities that we started with:

    | Capacity | Value |
    |----------|-------|
    | Min      | 3     |
    | Desired  | 6     |
    | Max      | 9     |  

    All 6 instances serving traffic are now running `XYZ`.

Full details can be seen via [the dashboard](https://metrics.gutools.co.uk/goto/EhZPyzeSg?orgId=1).


    