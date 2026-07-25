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
  BoardSortTriggerService,
  BoardSortTriggerState,
} from 'core-app/features/boards/board/board-sort/board-sort-trigger.service';
import { BoardSortModalComponent } from 'core-app/features/boards/board/board-sort/board-sort.modal';
import {
  BoardListContainerComponent,
} from 'core-app/features/boards/board/board-partitioned-page/board-list-container.component';
import { BoardListComponent } from 'core-app/features/boards/board/board-list/board-list.component';
import { Board } from 'core-app/features/boards/board/board';
import { GridResource } from 'core-app/features/hal/resources/grid-resource';
import { GridWidgetResource } from 'core-app/features/hal/resources/grid-widget-resource';

/**
 * Regression coverage for the "Sort by..." cross-component reach.
 *
 * The trigger BUTTON itself moved out of this component's own template into
 * the board toolbar (`BoardSortTriggerComponent`, registered next to the
 * filter button in `BoardPartitionedPageComponent.toolbarButtonComponents`) -
 * see that component's own spec for its rendering/gating/click behaviour.
 * This spec instead proves `BoardListContainerComponent` - which remains the
 * SOLE owner of the real per-column state via
 * `@ViewChildren(BoardListComponent) lists` - correctly PUBLISHES that state
 * into the shared `BoardSortTriggerService` reactively, and that this
 * component's own template no longer renders a "Sort by..." trigger at all
 * (proving the move actually happened, not just an addition alongside it).
 *
 * This also preserves the original regression intent from the previous
 * OnPush/ViewChildren reactivity bug fix: the underlying state must become
 * correctly known EVEN THOUGH nothing else re-triggers this (OnPush)
 * container's change detection - see `FakeBoardListComponent` below, which
 * mirrors the real `BoardListComponent`'s async query resolution via its own
 * `(sortabilityChange)` output.
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
   * `sortabilityChange`, exactly as production code does.
   */
  resolveQueryAsync(query:{ updateOrderedWorkPackages?:unknown }):void {
    this.query = query;
    this.sortabilityChange.emit();
  }
}

describe('BoardListContainerComponent "Sort by..." trigger reactivity (regression)', () => {
  let fixture:ComponentFixture<BoardListContainerComponent>;
  let component:BoardListContainerComponent;
  let boardSortTrigger:BoardSortTriggerService;
  let opModalServiceShow:ReturnType<typeof vi.fn>;
  let board:Board;

  function sortTriggerButtonInOwnTemplate() {
    return fixture.debugElement.query(By.css('[data-test-selector="board-sort--trigger"]'));
  }

  function fakeBoardListInstance():FakeBoardListComponent {
    return fixture.debugElement
      .query(By.directive(FakeBoardListComponent))
      .injector.get(FakeBoardListComponent);
  }

  function latestPublishedState():BoardSortTriggerState {
    let latest!:BoardSortTriggerState;
    boardSortTrigger.state$.subscribe((state) => { latest = state; }).unsubscribe();
    return latest;
  }

  beforeEach(() => {
    const grid = {
      id: 1,
      updateImmediately: true,
      options: { type: 'free' },
      widgets: [{ id: 1, options: { queryId: '1' } } as unknown as GridWidgetResource],
    } as unknown as GridResource;
    board = new Board(grid);
    opModalServiceShow = vi.fn();

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
        { provide: OpModalService, useValue: { show: opModalServiceShow } },
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
        BoardSortTriggerService,
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });

    fixture = TestBed.createComponent(BoardListContainerComponent);
    component = fixture.componentInstance;
    component.boardId = '1';
    boardSortTrigger = TestBed.inject(BoardSortTriggerService);
  });

  it('never renders a "Sort by..." trigger in its own template - the button moved to the board toolbar', async () => {
    fixture.autoDetectChanges();
    await fixture.whenStable();

    await Promise.resolve().then(() => {
      fakeBoardListInstance().resolveQueryAsync({ updateOrderedWorkPackages: { href: '/reorder' } });
    });
    await fixture.whenStable();

    // Even once fully sortable, this component's OWN template must never
    // render the trigger anymore.
    expect(sortTriggerButtonInOwnTemplate()).toBeNull();
  });

  it('publishes canSort=false to BoardSortTriggerService before any column resolves', async () => {
    fixture.autoDetectChanges();
    await fixture.whenStable();

    expect(latestPublishedState().canSort).toBe(false);
  });

  it('publishes canSort=true to BoardSortTriggerService once a column\'s query becomes ready asynchronously, with no other trigger in between', async () => {
    fixture.autoDetectChanges();
    await fixture.whenStable();

    await Promise.resolve().then(() => {
      fakeBoardListInstance().resolveQueryAsync({ updateOrderedWorkPackages: { href: '/reorder' } });
    });
    await fixture.whenStable();

    expect(latestPublishedState().canSort).toBe(true);
  });

  it('publishes canSort=false if the column resolves without reorder permission', async () => {
    fixture.autoDetectChanges();
    await fixture.whenStable();

    await Promise.resolve().then(() => {
      fakeBoardListInstance().resolveQueryAsync({ updateOrderedWorkPackages: undefined });
    });
    await fixture.whenStable();

    expect(latestPublishedState().canSort).toBe(false);
  });

  it('the published openModal() callback opens the same BoardSortModalComponent used before the move', async () => {
    fixture.autoDetectChanges();
    await fixture.whenStable();

    await Promise.resolve().then(() => {
      fakeBoardListInstance().resolveQueryAsync({ updateOrderedWorkPackages: { href: '/reorder' } });
    });
    await fixture.whenStable();

    latestPublishedState().openModal();

    expect(opModalServiceShow).toHaveBeenCalledTimes(1);
    expect(opModalServiceShow.mock.calls[0][0]).toBe(BoardSortModalComponent);
  });

  it('clears BoardSortTriggerService state on destroy', async () => {
    fixture.autoDetectChanges();
    await fixture.whenStable();

    await Promise.resolve().then(() => {
      fakeBoardListInstance().resolveQueryAsync({ updateOrderedWorkPackages: { href: '/reorder' } });
    });
    await fixture.whenStable();
    expect(latestPublishedState().canSort).toBe(true);

    fixture.destroy();

    expect(latestPublishedState().canSort).toBe(false);
  });
});
