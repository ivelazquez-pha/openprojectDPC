import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { I18nService } from 'core-app/core/i18n/i18n.service';
import {
  BoardSortTriggerComponent,
} from 'core-app/features/boards/board/board-sort/board-sort-trigger.component';
import {
  BoardSortTriggerService,
} from 'core-app/features/boards/board/board-sort/board-sort-trigger.service';

/**
 * Regression coverage for the toolbar-level "Sort by..." trigger: it now
 * lives next to the board filter button in `BoardPartitionedPageComponent`'s
 * `toolbarButtonComponents`, rather than in
 * `board-list-container.component.html` next to "Add list". This spec
 * exercises the REAL `BoardSortTriggerComponent` class and template, reading
 * state exclusively through `BoardSortTriggerService#state$` (via the
 * `async` pipe) - exactly as the real toolbar mounts it (a completely
 * separate branch of the component tree from `BoardListContainerComponent`).
 *
 * `op-icon` is stubbed with `NO_ERRORS_SCHEMA` equivalent (a minimal fake) so
 * this spec stays focused on the reactivity/gating contract, not on
 * unrelated icon markup.
 */
@Component({
  selector: 'op-icon',
  template: '',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class FakeOpIconComponent {
  @Input() iconClasses:string;
}

describe('BoardSortTriggerComponent (toolbar-level "Sort by..." trigger)', () => {
  let fixture:ComponentFixture<BoardSortTriggerComponent>;
  let boardSortTrigger:BoardSortTriggerService;

  function triggerButton() {
    return fixture.debugElement.query(By.css('[data-test-selector="board-sort--trigger"]'));
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [BoardSortTriggerComponent, FakeOpIconComponent],
      providers: [
        { provide: I18nService, useValue: { t: (key:string) => key } },
        BoardSortTriggerService,
      ],
    });

    fixture = TestBed.createComponent(BoardSortTriggerComponent);
    boardSortTrigger = TestBed.inject(BoardSortTriggerService);
    fixture.detectChanges();
  });

  it('stays hidden by default (no permission published yet), matching the old canSortBoard() gating', () => {
    expect(triggerButton()).toBeNull();
  });

  it('appears once BoardSortTriggerService publishes canSort=true', () => {
    boardSortTrigger.publish({ canSort: true, openModal: () => undefined });
    fixture.detectChanges();

    expect(triggerButton()).not.toBeNull();
  });

  it('hides again if BoardSortTriggerService publishes canSort=false (e.g. permission revoked/cleared)', () => {
    boardSortTrigger.publish({ canSort: true, openModal: () => undefined });
    fixture.detectChanges();
    expect(triggerButton()).not.toBeNull();

    boardSortTrigger.clear();
    fixture.detectChanges();

    expect(triggerButton()).toBeNull();
  });

  it('clicking the trigger invokes the published openModal() callback - the same modal-opening path BoardListContainerComponent always used', () => {
    const openModal = vi.fn();
    boardSortTrigger.publish({ canSort: true, openModal });
    fixture.detectChanges();

    triggerButton().triggerEventHandler('click', new MouseEvent('click'));

    expect(openModal).toHaveBeenCalledTimes(1);
  });
});
