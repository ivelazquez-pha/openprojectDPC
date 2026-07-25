import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { BoardSortTriggerService } from 'core-app/features/boards/board/board-sort/board-sort-trigger.service';
import {
  TestBoardEntryHostComponent,
  TestProjectedContentChildComponent,
  TestProjectingPageComponent,
} from './board-sort-trigger-toolbar-integration.test-doubles';

/**
 * Real-Angular-mechanism proof for the "Sort by..." toolbar relocation (see
 * `BoardSortTriggerService` for the production design).
 *
 * Production wiring being modelled:
 *
 *   BoardEntryComponent (template: `<board-partitioned-page><board-list-container /></board-partitioned-page>`)
 *     -> BoardPartitionedPageComponent   (provides `BoardSortTriggerService`, has `<ng-content>` + a
 *                                          toolbar `<ndc-dynamic>` entry using its OWN `Injector`)
 *          -> BoardListContainerComponent (content-projected via `<ng-content>`, publishes into
 *                                          `BoardSortTriggerService`)
 *          -> BoardSortTriggerComponent   (toolbar-rendered via `<ndc-dynamic>`, reads
 *                                          `BoardSortTriggerService#state$`)
 *
 * An attempt was made to build this EXACT tree using the real
 * `BoardPartitionedPageComponent`/`BoardListContainerComponent`/
 * `BoardSortTriggerComponent` classes declared ad hoc via
 * `TestBed.configureTestingModule({ declarations: [...] })`. That hits a
 * genuine Angular/ngtsc tooling limitation in THIS project's strict
 * whole-program template checking: ANY component class defined directly
 * inside a `.spec.ts` file does not get a usable AOT template-checking scope
 * from `TestBed.configureTestingModule({ declarations, imports })` -
 * EVERY child tag (even built-ins pulled in via `imports`, like
 * `ndc-dynamic` or the `async` pipe) comes back as "not known", regardless
 * of `templateUrl` vs inline `template`, and regardless of whether the
 * referenced component classes are brand new or already declared elsewhere
 * (ad hoc re-declaring already-declared production classes ALSO separately
 * fails with NG6007 "declared by more than one NgModule" if wrapped in a
 * real `@NgModule`). Reusing the real `BoardEntryComponent` as the root
 * avoids the spec-file-local-class problem, but pulls in an unrelated,
 * ~30-service-deep dependency graph via its `WorkPackageIsolatedQuerySpaceDirective`
 * host directive that is infeasible to mock safely under time pressure.
 *
 * The test doubles in `./board-sort-trigger-toolbar-integration.test-doubles.ts`
 * sidestep this: they are `standalone: true` components in a REAL
 * (non-`.spec.ts`) file, so their template scope resolves 100% statically
 * from each component's own `imports` array, independent of TestBed. They
 * use the REAL, unmodified `BoardSortTriggerService` (a plain
 * `@Injectable()`, not declared in any NgModule, so none of the conflicts
 * above apply) and reproduce the EXACT structural pattern in question:
 *   - `TestProjectingPageComponent`: `<ng-content>` AND a real
 *     `<ndc-dynamic>` toolbar entry created via ITS OWN `Injector` (exactly
 *     like `BoardPartitionedPageComponent`), providing
 *     `BoardSortTriggerService` in its own `providers` array;
 *   - `TestProjectedContentChildComponent`: content-projected, written in
 *     the host's template (exactly like `BoardEntryComponent` writes
 *     `<board-list-container>` inside `<board-partitioned-page>`), injects
 *     and publishes into `BoardSortTriggerService`;
 *   - `TestSortToolbarButtonComponent`: mounted only via `<ndc-dynamic>`
 *     using the page's `Injector` (exactly like `BoardSortTriggerComponent`),
 *     reads `BoardSortTriggerService#state$` reactively via the `async`
 *     pipe.
 *
 * If this passes, it proves - with real Angular-constructed instances, not
 * manually-wired mocks - that content projection through `<ng-content>` does
 * NOT break sharing of a component-provided service with a sibling mounted
 * via `<ndc-dynamic>` using that same providing component's `Injector`. That
 * result is consistent with (and reinforces confidence in) the fact that
 * `BoardListContainerComponent` already does
 * `inject(BoardPartitionedPageComponent)` successfully in existing,
 * currently-shipping production code (`saveBoard()`), which could not work
 * at all if content projection broke the injector chain the way it was
 * suspected to.
 */
describe('Board "Sort by..." toolbar trigger - content-projection + <ndc-dynamic> DI-sharing mechanism proof', () => {
  let fixture:ComponentFixture<TestBoardEntryHostComponent>;
  let pageComponent:TestProjectingPageComponent;
  let contentChild:TestProjectedContentChildComponent;

  function toolbarTriggerButton() {
    return fixture.debugElement.query(By.css('[data-test-selector="mirror-sort-trigger"]'));
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TestBoardEntryHostComponent],
    });

    fixture = TestBed.createComponent(TestBoardEntryHostComponent);
    pageComponent = fixture.debugElement
      .query(By.directive(TestProjectingPageComponent))
      .componentInstance as TestProjectingPageComponent;
    contentChild = fixture.debugElement
      .query(By.directive(TestProjectedContentChildComponent))
      .componentInstance as TestProjectedContentChildComponent;

    fixture.detectChanges();
  });

  it('shares the SAME BoardSortTriggerService instance between the content-projected child and the page\'s own Injector', () => {
    const pageInjected = pageComponent.injector.get(BoardSortTriggerService);

    expect(contentChild.boardSortTrigger).toBe(pageInjected);
  });

  it('does NOT render the toolbar trigger before the content-projected child publishes canSort=true', () => {
    expect(toolbarTriggerButton()).toBeNull();
  });

  it('renders the REAL toolbar trigger (via <ndc-dynamic>, using the page\'s own Injector) once the content-projected child publishes canSort=true', () => {
    expect(toolbarTriggerButton()).toBeNull();

    const openModal = vi.fn();
    contentChild.resolveSortable(openModal);
    fixture.detectChanges();

    const button = toolbarTriggerButton();
    expect(button).not.toBeNull();

    button.triggerEventHandler('click', new MouseEvent('click'));
    expect(openModal).toHaveBeenCalledTimes(1);
  });
});
