# Event Forwarder Lambda

A lambda triggered via AWS EventBridge events from the CloudFormation stacks, and autoscaling groups created by this repository.

The lambda will log the EventBridge event, which will get picked up by https://github.com/guardian/cloudwatch-logs-management
and sent to Central ELK.
