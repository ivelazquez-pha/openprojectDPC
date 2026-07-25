import {
  ChangeDetectionStrategy,
  Component,
  inject,
  Injector,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DynamicModule } from 'ng-dynamic-component';
import { BoardSortTriggerService } from 'core-app/features/boards/board/board-sort/board-sort-trigger.service';

/**
 * Test doubles for `board-sort-trigger-toolbar-integration.component.spec.ts`
 * - see that file's header comment for the full rationale.
 *
 * These MUST live in a real (non-`.spec.ts`) file and be `standalone: true`
 * with explicit `imports`. Declaring them inline inside the `.spec.ts` file
 * via `TestBed.configureTestingModule({ declarations: [...] })` was tried
 * first and does NOT work in this project: Angular's AOT template
 * type-checker does not build a usable scope for components whose class is
 * defined directly inside a `.spec.ts` file (every child tag, including
 * built-in things like `ndc-dynamic` and the `async` pipe brought in via
 * `imports` on the SAME ad hoc TestBed module, comes back as "not a known
 * element/pipe" - regardless of `templateUrl` vs inline `template`, and
 * regardless of whether the referenced classes are brand new or already
 * declared elsewhere). Standalone components sidestep this entirely because
 * their template scope is resolved 100% statically from their own `imports`
 * array, independent of any TestBed wiring.
 */
@Component({
  standalone: true,
  selector: 'test-sort-toolbar-button',
  imports: [CommonModule],
  template: `
    @if (state$ | async; as state) {
      @if (state.canSort) {
        <div data-test-selector="mirror-sort-trigger" (click)="state.openModal()"></div>
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TestSortToolbarButtonComponent {
  private readonly boardSortTrigger = inject(BoardSortTriggerService);

  public readonly state$ = this.boardSortTrigger.state$;
}

@Component({
  standalone: true,
  selector: 'test-projecting-page',
  imports: [DynamicModule],
  template: `
    <ng-content />
    <ndc-dynamic [ndcDynamicComponent]="toolbarButton" [ndcDynamicInjector]="injector" />
  `,
  providers: [BoardSortTriggerService],
})
export class TestProjectingPageComponent {
  readonly injector = inject(Injector);

  readonly toolbarButton = TestSortToolbarButtonComponent;
}

@Component({
  standalone: true,
  selector: 'test-projected-content-child',
  template: '',
})
export class TestProjectedContentChildComponent implements OnInit {
  readonly boardSortTrigger = inject(BoardSortTriggerService);

  ngOnInit():void {
    // Mirrors `BoardListContainerComponent.onColumnSortabilityChange()` ->
    // `publishSortTriggerState()`: publish reactively, never expose a
    // synchronous getter for the toolbar to poll.
    this.boardSortTrigger.publish({ canSort: false, openModal: () => undefined });
  }

  resolveSortable(openModal:() => void):void {
    this.boardSortTrigger.publish({ canSort: true, openModal });
  }
}

@Component({
  standalone: true,
  selector: 'test-board-entry-host',
  imports: [TestProjectingPageComponent, TestProjectedContentChildComponent],
  template: '<test-projecting-page><test-projected-content-child /></test-projecting-page>',
})
export class TestBoardEntryHostComponent {
}
