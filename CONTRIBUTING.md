# Contributing

This repository uses [`@guardian/cdk` (GuCDK)](https://github.com/guardian/cdk) to define the CloudFormation infrastructure.
Specifically, a [branch](https://github.com/guardian/cdk/pull/2417) of GuCDK is used.

There are also some [application artifacts](./dist) available.

## Deploying from healthy to healthy

For this deployment, we can swap between artifact `ABC` and `XYZ`.

For example:
1. Deploy[^1] `ABC`:
    ```ts
    new BasicAsgRollingUpdate(app, {
	 buildIdentifier: 'ABC',
    });
    ```
2. Deploy `XYZ`:
    ```ts
    new BasicAsgRollingUpdate(app, {
	 buildIdentifier: 'XYZ',
    });
    ```

## Deploying from healthy to unhealthy

For this deployment, we can swap between artifact `ABC` and `500`.

For example:
1. Deploy `ABC`:
    ```ts
    new BasicAsgRollingUpdate(app, {
	 buildIdentifier: 'ABC',
    });
    ```
2. Deploy `500`:
    ```ts
    new BasicAsgRollingUpdate(app, {
	 buildIdentifier: '500',
    });
    ```

## Deploying from unhealthy to healthy

For this deployment, we can swap between artifact `500` and `ABC`.

For example:
1. Deploy `500`:
    ```ts
    new BasicAsgRollingUpdate(app, {
	 buildIdentifier: '500',
    });
    ```
2. Deploy `ABC`:
    ```ts
    new BasicAsgRollingUpdate(app, {
	 buildIdentifier: 'ABC',
    });
    ```

## Creating a new stack

First, define it in [lib directory](./packages/cdk/lib). It would look roughly like this:

```ts
interface MyTestStackProps {
 buildIdentifier: 'ABC' | 'XYZ' | '500';
}

export class MyTestStack extends GuStack {
 constructor(scope: App, props: MyTestStackProps) {
  const { buildIdentifier } = props;

  const app = 'no-desired';
  const domainName = `${app}.rolling-update.gutools.co.uk`;
  const filename = `testing-asg-rolling-update_${buildIdentifier}.deb`;

  super(scope, app, {
   stack: 'playground',
   stage: 'CODE',
   app,
   env: {
    region: 'eu-west-1',
   },
  });
  
  const { loadBalancer } = new GuEc2AppExperimental(...);

  new GuCname(this, 'DNS', {
   app,
   ttl: Duration.hours(1),
   domainName,
   resourceRecord: loadBalancer.loadBalancerDnsName,
  });
 }
}
```

You can customise further customise it, for example adding a scaling policy.

Then, instantiate an instance of the class in [cdk.ts](./packages/cdk/bin/cdk.ts).

Then, push the changes to GitHub, and wait for a build to be created.

Finally, deploy the project [`playground::testing-asg-rolling-update` with Riff-Raff](https://riffraff.gutools.co.uk/deployment/history?projectName=playground%3A%3Atesting-asg-rolling-update&page=1)
and observe your new CloudFormation stack being created in the [Developer Playground AWS account](https://janus.gutools.co.uk/console?permissionId=developerPlayground-dev&tzOffset=1).

[^1]: Edit [cdk.ts](./packages/cdk/bin/cdk.ts), push to GitHub, build w/GitHub Actions, deploy w/Riff-Raff.
