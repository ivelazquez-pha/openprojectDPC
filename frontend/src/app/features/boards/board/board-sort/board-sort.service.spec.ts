import { TestBed } from '@angular/core/testing';
import { Subject, firstValueFrom, of, throwError } from 'rxjs';
import { ApiV3Service } from 'core-app/core/apiv3/api-v3.service';
import { QuerySortByResource } from 'core-app/features/hal/resources/query-sort-by-resource';
import { BoardSortService } from 'core-app/features/boards/board/board-sort/board-sort.service';

describe('BoardSortService', () => {
  let createSpy:ReturnType<typeof vi.fn>;
  let idSpy:ReturnType<typeof vi.fn>;
  let service:BoardSortService;

  function configure(createImpl:() => unknown) {
    createSpy = vi.fn(createImpl);
    idSpy = vi.fn(() => ({ boardOrder: { create: createSpy } }));

    const apiV3ServiceStub = {
      grids: {
        id: idSpy,
      },
    };

    TestBed.configureTestingModule({
      providers: [
        BoardSortService,
        { provide: ApiV3Service, useValue: apiV3ServiceStub },
      ],
    });

    service = TestBed.inject(BoardSortService);
  }

  it('sends the backend-accepted (snake_case) field name and the chosen direction', async () => {
    configure(() => of(undefined));

    await firstValueFrom(service.applyAndRefresh('42', 'dueDate', 'desc', () => undefined));

    expect(idSpy).toHaveBeenCalledWith('42');
    expect(createSpy).toHaveBeenCalledWith('due_date', 'desc');
  });

  it('invokes the refresh callback only after the request succeeds', async () => {
    const subject = new Subject<void>();
    configure(() => subject.asObservable());
    const refresh = vi.fn();

    const promise = firstValueFrom(service.applyAndRefresh('1', 'subject', 'asc', refresh));

    // Not yet committed - refresh must not have fired.
    expect(refresh).not.toHaveBeenCalled();

    subject.next(undefined);
    subject.complete();

    await promise;

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('does not invoke the refresh callback when the request fails (e.g. 500-card limit exceeded)', async () => {
    configure(() => throwError(() => new Error('BoardSortLimitExceeded')));
    const refresh = vi.fn();

    await expect(firstValueFrom(service.applyAndRefresh('1', 'subject', 'asc', refresh)))
      .rejects.toThrow();

    expect(refresh).not.toHaveBeenCalled();
  });

  it('delegates field intersection to the pure intersection logic', () => {
    configure(() => of(undefined));

    const columnA = [
      { column: { id: 'subject', name: 'Subject', href: '/x/subject' }, direction: { href: 'asc' } },
    ] as unknown as QuerySortByResource[];
    const columnB = [
      { column: { id: 'subject', name: 'Subject', href: '/x/subject' }, direction: { href: 'asc' } },
    ] as unknown as QuerySortByResource[];

    expect(service.intersectFields([columnA, columnB])).toEqual([{ id: 'subject', name: 'Subject' }]);
  });
});
