import { HttpErrorResponse } from '@angular/common/http';
import { defer, firstValueFrom, of, throwError } from 'rxjs';
import { retryPassingFaults } from './invidious-api';

function failingTimes(times: number, status: number) {
  let calls = 0;
  const request = defer(() => {
    calls++;
    return calls <= times ? throwError(() => new HttpErrorResponse({ status })) : of('answer');
  });
  return { request, calls: () => calls };
}

describe('retryPassingFaults', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('tries again after a 503 and gets the answer', async () => {
    const { request, calls } = failingTimes(2, 503);
    const answer = firstValueFrom(retryPassingFaults(request));
    await vi.advanceTimersByTimeAsync(4500);
    expect(await answer).toBe('answer');
    expect(calls()).toBe(3);
  });

  it('gives up after two retries', async () => {
    const { request, calls } = failingTimes(5, 500);
    const answer = firstValueFrom(retryPassingFaults(request)).catch((error) => error.status);
    await vi.advanceTimersByTimeAsync(4500);
    expect(await answer).toBe(500);
    expect(calls()).toBe(3);
  });

  it('does not retry an answer that will not change, like 404 or 403', async () => {
    const { request, calls } = failingTimes(1, 404);
    expect(await firstValueFrom(retryPassingFaults(request)).catch((error) => error.status)).toBe(404);
    expect(calls()).toBe(1);
  });
});
