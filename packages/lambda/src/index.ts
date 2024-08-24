import type { AutoscalingEvent, CloudformationEvent } from './types';

export function main(event: CloudformationEvent | AutoscalingEvent) {
	console.log(JSON.stringify(event));
}
