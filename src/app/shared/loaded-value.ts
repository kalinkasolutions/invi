import { Resource } from '@angular/core';

/** The resource's value, or undefined while it loads or after it failed, where value() throws. */
export function loadedValue<T>(resource: Resource<T>): T | undefined {
  return resource.hasValue() ? resource.value() : undefined;
}
