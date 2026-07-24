import {
  Component,
  EventEmitter,
  forwardRef,
  Input,
  NO_ERRORS_SCHEMA,
  Output,
} from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { StateService } from '@uirouter/core';
import { I18nService } from 'core-app/core/i18n/i18n.service';
import { ToastService } from 'core-app/shared/components/toaster/toast.service';
import { HalResourceNotificationService } from 'core-app/features/hal/services/hal-resource-notification.service';
import {
  BoardPartitionedPageComponent,
} from 'core-app/features/boards/board/board-partitioned-page/board-partitioned-page.component';
import { BoardListsService } from 'core-app/features/boards/board/board-list/board-lists.service';
import { OpModalService } from 'core-app/shared/components/modal/modal.service';
import { BoardService } from 'core-app/features/boards/board/board.service';
import { DragAndDropService } from 'core-app/shared/helpers/drag-and-drop/drag-and-drop.service';
import { QueryUpdatedService } from 'core-app/features/boards/board/query-updated/query-updated.service';
import { BoardActionsRegistryService } from 'core-app/features/boards/board/board-actions/board-actions-registry.service';
import { ApiV3Service } from 'core-app/core/apiv3/api-v3.service';
import { PathHelperService } from 'core-app/core/path-helper/path-helper.service';
import { CurrentProjectService } from 'core-app/core/current-project/current-project.service';
import { States } from 'core-app/core/states/states.service';
import { BoardSortService } from 'core-app/features/boards/board/board-sort/board-sort.service';
import {
  BoardListContainerComponent,
} from 'core-app/features/boards/board/board-partitioned-page/board-list-container.component';
import { BoardListComponent } from 'core-app/features/boards/board/board-list/board-list.component';
import { Board } from 'core-app/features/boards/board/board';
import { GridResource } from 'core-app/features/hal/resources/grid-resource';
import { GridWidgetResource } from 'core-app/features/hal/resources/grid-widget-resource';

/**
 * Regression coverage for the live-production bug: the board-wide
 * "Sort by..." trigger (`@if (board.editable && canSortBoard())` in
 * `board-list-container.component.html`) never appeared when a board first
 * loaded, even once every column had genuinely finished loading and the
 * user had permission - it only appeared AFTER some UNRELATED user action
 * (e.g. applying a filter) happened to trigger the container's own change
 * detection afterwards.
 *
 * Root cause: `BoardListContainerComponent` is `OnPush` and reads each
 * column's state synchronously through `@ViewChildren(BoardListComponent)
 * lists` (`canSortBoard()`/`availableSortFields()`). Each `BoardListComponent`
 * is ALSO `OnPush` and only calls its OWN `cdRef.detectChanges()` once its
 * query resolves asynchronously - that never re-checks the PARENT's
 * template, so the button's underlying condition became true quietly and
 * Angular never re-rendered it until something else happened to trigger the
 * container's own change detection.
 *
 * This spec substitutes the real `BoardListComponent` (whose own
 * constructor dependency graph is unrelated to this bug and would make this
 * test unnecessarily heavy) with a minimal `FakeBoardListComponent` that
 * re-provides itself AS `BoardListComponent` via DI aliasing
 * (`useExisting`), so `@ViewChildren(BoardListComponent) lists` - the exact
 * production query used by `canSortBoard()`/`availableSortFields()` - still
 * matches it. Everything else (the real `BoardListContainerComponent` class
 * AND its real, unmodified `board-list-container.component.html` template,
 * including the `(sortabilityChange)` binding under test) is exercised as-is.
 *
 * The test genuinely exercises the async/OnPush timing: it uses
 * `fixture.autoDetectChanges()` (mirrors a real running app's automatic
 * change detection) plus a real `Promise` resolution and
 * `fixture.whenStable()` to simulate the column's query resolving AFTER the
 * container's initial render, with NO other trigger (like a filter change,
 * or a manually-forced extra `fixture.detectChanges()` call) happening in
 * between - so reverting the fix (removing the `(sortabilityChange)`
 * binding/emit) makes it fail again exactly like the real bug.
 */
@Component({
  selector: 'board-list',
  template: '',
  standalone: false,
  providers: [
    { provide: BoardListComponent, useExisting: forwardRef(() => FakeBoardListComponent) },
  ],
})
class FakeBoardListComponent {
  @Input() resource:unknown;

  @Input() board:unknown;

  @Output() onRemove = new EventEmitter<void>();

  @Output() visibilityChange = new EventEmitter<boolean>();

  @Output() sortabilityChange = new EventEmitter<void>();

  /** Mirrors just enough of the real `BoardListComponent` for
   * `canSortBoard()` (via `!!list.query?.updateOrderedWorkPackages`) and
   * `availableSortFields` (via `list.availableSortFields`) to react
   * realistically. */
  query:{ updateOrderedWorkPackages?:unknown }|undefined = undefined;

  availableSortFields:unknown[] = [];

  /**
   * Simulates the REAL `BoardListComponent`'s async query resolution
   * (`querySpace.query.values$()` subscribe): sets `query` (so
   * `canSortBoard()`'s underlying data becomes true) and fires
   * `sortabilityChange`, exactly as the fixed production code now does.
   */
  resolveQueryAsync(query:{ updateOrderedWorkPackages?:unknown }):void {
    this.query = query;
    this.sortabilityChange.emit();
  }
}

describe('BoardListContainerComponent "Sort by..." trigger reactivity (regression)', () => {
  let fixture:ComponentFixture<BoardListContainerComponent>;
  let component:BoardListContainerComponent;
  let board:Board;

  function sortTriggerButton() {
    return fixture.debugElement.query(By.css('[data-test-selector="board-sort--trigger"]'));
  }

  function fakeBoardListInstance():FakeBoardListComponent {
    return fixture.debugElement
      .query(By.directive(FakeBoardListComponent))
      .injector.get(FakeBoardListComponent);
  }

  beforeEach(() => {
    const grid = {
      id: 1,
      updateImmediately: true,
      options: { type: 'free' },
      widgets: [{ id: 1, options: { queryId: '1' } } as unknown as GridWidgetResource],
    } as unknown as GridResource;
    board = new Board(grid);

    TestBed.configureTestingModule({
      declarations: [BoardListContainerComponent, FakeBoardListComponent],
      providers: [
        { provide: I18nService, useValue: { t: (key:string) => key } },
        { provide: StateService, useValue: {} },
        { provide: ToastService, useValue: {} },
        { provide: HalResourceNotificationService, useValue: {} },
        { provide: BoardPartitionedPageComponent, useValue: {} },
        { provide: BoardListsService, useValue: {} },
        { provide: BoardActionsRegistryService, useValue: {} },
        { provide: OpModalService, useValue: { show: () => undefined } },
        {
          provide: ApiV3Service,
          useValue: { boards: { id: () => ({ requireAndStream: () => of(board) }) } },
        },
        { provide: BoardService, useValue: { currentBoard$: { next: () => undefined } } },
        { provide: DragAndDropService, useValue: { addScrollContainer: () => undefined } },
        { provide: QueryUpdatedService, useValue: { monitor: () => of({ elements: [] }) } },
        { provide: PathHelperService, useValue: {} },
        { provide: CurrentProjectService, useValue: {} },
        { provide: States, useValue: {} },
        { provide: BoardSortService, useValue: { unionFields: () => [] } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });

    fixture = TestBed.createComponent(BoardListContainerComponent);
    component = fixture.componentInstance;
    component.boardId = '1';
  });

  it('shows the trigger once a column\'s query becomes ready asynchronously after the initial render, with no other trigger in between', async () => {
    fixture.autoDetectChanges();
    await fixture.whenStable();

    // Sanity: the board actually rendered and our fake column is in place.
    expect(fixture.debugElement.query(By.directive(FakeBoardListComponent))).not.toBeNull();

    // Before the column's query resolves: nothing is known to be sortable
    // yet -> the trigger must not be shown.
    expect(sortTriggerButton()).toBeNull();

    // Simulate the column's query resolving AFTER the initial render -
    // purely via real async resolution, no manual `fixture.detectChanges()`
    // and no unrelated container-level action (like a filter change).
    await Promise.resolve().then(() => {
      fakeBoardListInstance().resolveQueryAsync({ updateOrderedWorkPackages: { href: '/reorder' } });
    });
    await fixture.whenStable();

    expect(sortTriggerButton()).not.toBeNull();
  });

  it('keeps the trigger hidden if the column\'s query resolves without reorder permission', async () => {
    fixture.autoDetectChanges();
    await fixture.whenStable();

    await Promise.resolve().then(() => {
      fakeBoardListInstance().resolveQueryAsync({ updateOrderedWorkPackages: undefined });
    });
    await fixture.whenStable();

    expect(sortTriggerButton()).toBeNull();
  });
});
