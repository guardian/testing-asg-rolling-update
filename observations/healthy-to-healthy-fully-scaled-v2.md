# What happens when deploying a 'good' build when the service is already fully scaled up?

In this test we went from [application version](../dist) `ABC` to `XYZ` in the stack:
- [`ScalingAsgRollingUpdate`](../packages/cdk/lib/scaling-asg-rolling-update.ts) (CFN stack `playground-CODE-scaling-asg-rolling-update`).

In response to a [previous version of this test](healthy-to-healthy-fully-scaled.md), we also injected the current
desired capacity (minus 1) as the value for the
[`MinInstancesInService`](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-attribute-updatepolicy.html#cfn-attributes-updatepolicy-rollingupdate-mininstancesinservice)
property before starting the rolling update.

The main aim of this test was to establish whether setting `MinInstancesInService` dynamically would allow us to avoid
the undesirable mid-deployment under-provisioning that we noticed when this value was hardcoded.

## Highlights

Setting the `MinInstancesInService` property dynamically allows us to deploy slowly, whilst managing the
risk of mid-deployment performance problems by removing one instance at a time.

## Timeline

1. [Build number 116 was deployed](https://riffraff.gutools.co.uk/deployment/view/587f6951-396d-4e11-8f6e-ead7e628383f)
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

3. [Build number 120 was deployed](https://riffraff.gutools.co.uk/deployment/view/79dc6014-9f52-4dc9-9abb-32623cec3cf0).
   This updates to use artifact `XYZ` _and_ [sets `MinInstancesInService` to 8](https://github.com/guardian/testing-asg-rolling-update/compare/main...jw-min-8-xyz).

   _Note that this must be set to 8 (desired minus 1) and not 9 (desired) for the rolling update properties to be
   accepted by CloudFormation._

4. The CFN stack `playground-CODE-scaling-asg-rolling-update` begins to update the ASG. Due to the dynamically set
`MinInstancesInService` property, AWS now avoids under-provisioning the service during the deployment:

   > Rolling update initiated. Terminating 9 obsolete instance(s) in batches of 1, while keeping at least 8 instance(s) in service.

   Note that, unlike in other scenarios, the ASG capacities are never modified:
    
    | Capacity | Value |
    |----------|-------|
    | Min      | 3     |
    | Desired  | 9     |
    | Max      | 9     |

5. 1 instance is terminated and 1 new one is launched.

   >  Terminating instance(s) [i-05c73f48e5bf41823]; replacing with 1 new instance(s).

   There are 8 instances capable of serving requests (all running `ABC`).

6. AWS receives a `SUCCESS` signal from the instance launched in the previous step:

    > Successfully terminated instance(s) [i-05c73f48e5bf41823] (Progress 11%).
    > Received SUCCESS signal with UniqueId i-08195865aff4a373c

   There are (briefly) 9 instances capable of serving requests (8 running `ABC` and 1 running `XYZ`).

7. AWS repeats this process for the remaining instances running `ABC`.

   The ASG capacities are not modified.

   We always have (at least) 8 instances capable of serving requests.

8. Eventually AWS receives the `SUCCESS` signal from the final instance launched with `XYZ` and the deployment
completes.

    The ASG capacities are still unmodified.

    We now have 9 instances capable of serving requests (all running `XYZ`).

In this case the deployment took ~17 minutes. This would be even longer if: 

a) There were more instances running at the start of the deployment (e.g. if `Max` and `Desired` were both 18).

b) The application was slower to start (e.g. if it had a more complex userdata script or healthcheck).

Full details can be seen via [the dashboard](https://metrics.gutools.co.uk/goto/BoGywk6SR?orgId=1).


    