import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { I18nService } from 'core-app/core/i18n/i18n.service';
import { HalResourceNotificationService } from 'core-app/features/hal/services/hal-resource-notification.service';
import { ToastService } from 'core-app/shared/components/toaster/toast.service';
import { OpModalLocalsToken } from 'core-app/shared/components/modal/modal.service';
import { BoardSortService } from 'core-app/features/boards/board/board-sort/board-sort.service';
import { BoardSortModalComponent } from 'core-app/features/boards/board/board-sort/board-sort.modal';

describe('BoardSortModalComponent', () => {
  let fixture:ComponentFixture<BoardSortModalComponent>;
  let component:BoardSortModalComponent;
  let applyAndRefreshSpy:ReturnType<typeof vi.fn>;
  let handleRawErrorSpy:ReturnType<typeof vi.fn>;
  let addSuccessSpy:ReturnType<typeof vi.fn>;
  let closeSpy:ReturnType<typeof vi.fn>;
  let refresh:ReturnType<typeof vi.fn>;

  function setup(
    availableFields = [{ id: 'subject', name: 'Subject' }, { id: 'dueDate', name: 'Finish date' }],
    applyAndRefreshImpl:() => unknown = () => of(undefined),
  ) {
    applyAndRefreshSpy = vi.fn(applyAndRefreshImpl);
    handleRawErrorSpy = vi.fn();
    addSuccessSpy = vi.fn();
    closeSpy = vi.fn();
    refresh = vi.fn();

    TestBed.configureTestingModule({
      declarations: [BoardSortModalComponent],
      providers: [
        { provide: I18nService, useValue: { t: (key:string) => key } },
        { provide: HalResourceNotificationService, useValue: { handleRawError: handleRawErrorSpy } },
        { provide: ToastService, useValue: { addSuccess: addSuccessSpy } },
        { provide: BoardSortService, useValue: { applyAndRefresh: applyAndRefreshSpy } },
        {
          provide: OpModalLocalsToken,
          useValue: {
            gridId: '42',
            availableFields,
            refresh,
            service: { close: closeSpy },
          },
        },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    });
    void TestBed.compileComponents();

    fixture = TestBed.createComponent(BoardSortModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('defaults the selection to the first available field and ascending direction', () => {
    setup();

    expect(component.selectedFieldId).toBe('subject');
    expect(component.direction).toBe('asc');
  });

  it('offers only the fields provided (the already-unioned sortable fields)', () => {
    setup();

    expect(component.availableFields.map((field) => field.id)).toEqual(['subject', 'dueDate']);
  });

  it('is busy (inFlight) while the request is in flight, and no longer busy once it resolves', async () => {
    const subject = new Subject<void>();
    setup(undefined, () => subject.asObservable());

    component.apply();
    expect(component.inFlight).toBe(true);

    subject.next(undefined);
    subject.complete();
    await Promise.resolve();

    expect(component.inFlight).toBe(false);
  });

  it('sends the selected field id and direction, shows a success toast and closes the modal on success', () => {
    setup();

    component.selectField('dueDate');
    component.selectDirection('desc');
    component.apply();

    expect(applyAndRefreshSpy).toHaveBeenCalledWith('42', 'dueDate', 'desc', refresh);
    expect(addSuccessSpy).toHaveBeenCalledTimes(1);
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it('is no longer busy and surfaces the exact backend error (e.g. the 500-card limit message) on failure, without closing', () => {
    const backendError = { message: 'There are more than 500 visible cards on this board. Apply filters to reduce them before sorting.' };
    setup(undefined, () => throwError(() => backendError));

    component.apply();

    expect(component.inFlight).toBe(false);
    expect(handleRawErrorSpy).toHaveBeenCalledWith(backendError);
    expect(addSuccessSpy).not.toHaveBeenCalled();
    expect(closeSpy).not.toHaveBeenCalled();
  });

  it('does not send a request twice while one is already in flight', () => {
    const subject = new Subject<void>();
    setup(undefined, () => subject.asObservable());

    component.apply();
    component.apply();

    expect(applyAndRefreshSpy).toHaveBeenCalledTimes(1);
  });
});
