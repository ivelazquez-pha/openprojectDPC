import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { StateService } from '@uirouter/core';
import { IsolatedQuerySpace } from 'core-app/features/work-packages/directives/query-space/isolated-query-space';
import { States } from 'core-app/core/states/states.service';
import { ApiV3Service } from 'core-app/core/apiv3/api-v3.service';
import { ToastService } from 'core-app/shared/components/toaster/toast.service';
import { I18nService } from 'core-app/core/i18n/i18n.service';
import { UrlParamsHelperService } from 'core-app/features/work-packages/components/wp-query/url-params-helper';
import { PaginationService } from 'core-app/shared/components/table-pagination/pagination-service';
import { ConfigurationService } from 'core-app/core/config/configuration.service';
import { CurrentUserService } from 'core-app/core/current-user/current-user.service';
import { SubmenuService } from 'core-app/core/main-menu/submenu.service';
import { WorkPackagesListChecksumService } from 'core-app/features/work-packages/components/wp-list/wp-list-checksum.service';
import { WorkPackagesListInvalidQueryService } from 'core-app/features/work-packages/components/wp-list/wp-list-invalid-query.service';
import { WorkPackagesQueryViewService } from 'core-app/features/work-packages/components/wp-list/wp-query-view.service';
import { WorkPackageStatesInitializationService } from 'core-app/features/work-packages/components/wp-list/wp-states-initialization.service';
import { WorkPackagesListService } from 'core-app/features/work-packages/components/wp-list/wp-list.service';
import { WorkPackageViewSortByService } from 'core-app/features/work-packages/routing/wp-view-base/view-services/wp-view-sort-by.service';
import { WorkPackageViewFiltersService } from 'core-app/features/work-packages/routing/wp-view-base/view-services/wp-view-filters.service';
import { WorkPackageViewColumnsService } from 'core-app/features/work-packages/routing/wp-view-base/view-services/wp-view-columns.service';
import { WorkPackageViewGroupByService } from 'core-app/features/work-packages/routing/wp-view-base/view-services/wp-view-group-by.service';
import { WorkPackageViewCollapsedGroupsService } from 'core-app/features/work-packages/routing/wp-view-base/view-services/wp-view-collapsed-groups.service';
import { WorkPackageViewSumService } from 'core-app/features/work-packages/routing/wp-view-base/view-services/wp-view-sum.service';
import { WorkPackageViewTimelineService } from 'core-app/features/work-packages/routing/wp-view-base/view-services/wp-view-timeline.service';
import { WorkPackageViewHierarchiesService } from 'core-app/features/work-packages/routing/wp-view-base/view-services/wp-view-hierarchy.service';
import { WorkPackageViewHighlightingService } from 'core-app/features/work-packages/routing/wp-view-base/view-services/wp-view-highlighting.service';
import { WorkPackageViewRelationColumnsService } from 'core-app/features/work-packages/routing/wp-view-base/view-services/wp-view-relation-columns.service';
import { WorkPackageViewPaginationService } from 'core-app/features/work-packages/routing/wp-view-base/view-services/wp-view-pagination.service';
import { WorkPackageViewOrderService } from 'core-app/features/work-packages/routing/wp-view-base/view-services/wp-view-order.service';
import { WorkPackageViewAdditionalElementsService } from 'core-app/features/work-packages/routing/wp-view-base/view-services/wp-view-additional-elements.service';
import { WorkPackageViewDisplayRepresentationService } from 'core-app/features/work-packages/routing/wp-view-base/view-services/wp-view-display-representation.service';
import { WorkPackageViewIncludeSubprojectsService } from 'core-app/features/work-packages/routing/wp-view-base/view-services/wp-view-include-subprojects.service';
import { WorkPackageViewBaselineService } from 'core-app/features/work-packages/routing/wp-view-base/view-services/wp-view-baseline.service';
import { QueryResource } from 'core-app/features/hal/resources/query-resource';
import { QueryFormResource } from 'core-app/features/hal/resources/query-form-resource';
import { QuerySortByResource } from 'core-app/features/hal/resources/query-sort-by-resource';
import { applyLoadedBoardColumnQuery } from 'core-app/features/boards/board/board-list/board-list.component';

/**
 * Regression coverage for the "Sort by..." picker always reporting
 * "No field is sortable on any list of this board" - even for boards whose
 * columns have plenty of real sortable fields/custom fields.
 *
 * Root cause: board columns only ever called
 * `WorkPackageStatesInitializationService.updateQuerySpace()` directly.
 * Unlike the table view (`WorkPackagesListService`'s `queryLoading`
 * pipeline), that path never fetches the query's form nor calls
 * `updateStatesFromForm()`, which is the ONLY place that populates
 * `querySpace.available.sortBy`. `WorkPackageViewSortByService.available`
 * therefore stayed permanently empty for every board column.
 *
 * This spec exercises the REAL `WorkPackageStatesInitializationService`,
 * `WorkPackagesListService` and `WorkPackageViewSortByService` production
 * code (wired exactly as `WorkPackageIsolatedQuerySpaceDirective` wires
 * them for a real board column), stubbing only the HTTP boundary
 * (`ApiV3Service.queries.form.load`). It calls the exact exported function
 * `applyLoadedBoardColumnQuery` that `BoardListComponent.loadQuery()` now
 * delegates to - so reverting the fix (removing the `conditionallyLoadForm`
 * call from that function) makes the "FIX" test below fail again.
 */
function sortBy(id:string, name:string, direction = 'asc'):QuerySortByResource {
  return {
    column: { id, name, href: `/api/v3/queries/columns/${id}` },
    direction: { href: `urn:openproject-org:api:v3:queries:directions:${direction}` },
  } as unknown as QuerySortByResource;
}

function fakeQuery():QueryResource {
  return {
    id: '1',
    name: 'Column A',
    filters: [],
    sortBy: [],
    timestamps: [],
    $links: { update: { href: '/api/v3/queries/1' } },
    results: {
      elements: [],
      groups: [],
      $links: {},
      schemas: undefined,
    },
  } as unknown as QueryResource;
}

function fakeForm(customField:QuerySortByResource):QueryFormResource {
  return {
    // `WorkPackagesListService.conditionallyLoadForm` caches by comparing
    // `query.$links.update.href` against the previously loaded form's own
    // `href` - match `fakeQuery()`'s update link here so the "only fetches
    // once" caching test below exercises the real cache-hit branch.
    href: '/api/v3/queries/1',
    schema: {
      filtersSchemas: { elements: [] },
      columns: { allowedValues: [] },
      sortBy: { allowedValues: [sortBy('id', 'ID'), customField] },
      groupBy: { allowedValues: [] },
      displayRepresentation: { allowedValues: [] },
    },
  } as unknown as QueryFormResource;
}

function flushMicroAndMacroTasks():Promise<void> {
  return new Promise((resolve) => { setTimeout(resolve, 0); });
}

describe('BoardListComponent board column query space wiring (regression)', () => {
  let wpStatesInitialization:WorkPackageStatesInitializationService;
  let wpListService:WorkPackagesListService;
  let wpTableSortBy:WorkPackageViewSortByService;
  let formLoadSpy:ReturnType<typeof vi.fn>;

  beforeEach(() => {
    formLoadSpy = vi.fn();

    const apiV3ServiceStub = {
      queries: {
        form: {
          load: formLoadSpy,
        },
      },
    };

    // Inert stand-ins for the query-space services this bug/fix does not
    // concern: they only need to exist (their real production `initialize`
    // bodies are exercised elsewhere) so the REAL
    // `WorkPackageStatesInitializationService.updateQuerySpace()` can run
    // unmodified, exactly as `board-list.component.ts` already calls it.
    const noop = { initialize: () => undefined, clear: () => undefined };

    TestBed.configureTestingModule({
      providers: [
        // Real - this IS the wiring under test.
        IsolatedQuerySpace,
        States,
        WorkPackageViewSortByService,
        WorkPackageViewFiltersService,
        WorkPackageStatesInitializationService,
        WorkPackagesListService,

        // HTTP boundary - the only thing stubbed with actual behavior.
        { provide: ApiV3Service, useValue: apiV3ServiceStub },

        // Irrelevant-to-this-bug dependencies of the two real services
        // above: lightweight/no-op stand-ins only.
        { provide: StateService, useValue: {} },
        { provide: ToastService, useValue: {} },
        { provide: I18nService, useValue: { t: (key:string) => key } },
        { provide: UrlParamsHelperService, useValue: {} },
        { provide: PaginationService, useValue: {} },
        { provide: ConfigurationService, useValue: {} },
        { provide: CurrentUserService, useValue: {} },
        { provide: SubmenuService, useValue: {} },
        { provide: WorkPackagesListChecksumService, useValue: {} },
        { provide: WorkPackagesListInvalidQueryService, useValue: {} },
        { provide: WorkPackagesQueryViewService, useValue: {} },
        { provide: WorkPackageViewColumnsService, useValue: noop },
        { provide: WorkPackageViewGroupByService, useValue: noop },
        { provide: WorkPackageViewCollapsedGroupsService, useValue: noop },
        { provide: WorkPackageViewSumService, useValue: noop },
        { provide: WorkPackageViewTimelineService, useValue: noop },
        { provide: WorkPackageViewHierarchiesService, useValue: noop },
        { provide: WorkPackageViewHighlightingService, useValue: noop },
        { provide: WorkPackageViewRelationColumnsService, useValue: noop },
        { provide: WorkPackageViewPaginationService, useValue: noop },
        { provide: WorkPackageViewOrderService, useValue: noop },
        { provide: WorkPackageViewAdditionalElementsService, useValue: noop },
        { provide: WorkPackageViewDisplayRepresentationService, useValue: noop },
        { provide: WorkPackageViewIncludeSubprojectsService, useValue: noop },
        { provide: WorkPackageViewBaselineService, useValue: noop },
      ],
    });

    wpStatesInitialization = TestBed.inject(WorkPackageStatesInitializationService);
    wpListService = TestBed.inject(WorkPackagesListService);
    wpTableSortBy = TestBed.inject(WorkPackageViewSortByService);
  });

  it('documents the bug: updateQuerySpace alone (the pre-fix board-list.component.ts behaviour) never populates this column\'s available sort fields', () => {
    const query = fakeQuery();

    wpStatesInitialization.updateQuerySpace(query, query.results);

    expect(wpTableSortBy.available).toEqual([]);
    expect(formLoadSpy).not.toHaveBeenCalled();
  });

  it('FIX: applyLoadedBoardColumnQuery also requests the query form and populates this column\'s available sort fields, including a custom field', async () => {
    const query = fakeQuery();
    const customField = sortBy('customField1', 'My Custom Field');
    formLoadSpy.mockReturnValue(of([fakeForm(customField), query]));

    applyLoadedBoardColumnQuery(wpStatesInitialization, wpListService, query);

    await flushMicroAndMacroTasks();

    expect(formLoadSpy).toHaveBeenCalledWith(query);
    expect(wpTableSortBy.available.map((field) => field.column.href)).toContain('/api/v3/queries/columns/customField1');
    expect(wpTableSortBy.isSortable({ href: '/api/v3/queries/columns/customField1' } as any)).toBe(true);
  });

  it('only fetches the form once per distinct query (reuses WorkPackagesListService.conditionallyLoadForm caching)', async () => {
    const query = fakeQuery();
    const customField = sortBy('customField1', 'My Custom Field');
    formLoadSpy.mockReturnValue(of([fakeForm(customField), query]));

    applyLoadedBoardColumnQuery(wpStatesInitialization, wpListService, query);
    await flushMicroAndMacroTasks();

    applyLoadedBoardColumnQuery(wpStatesInitialization, wpListService, query);
    await flushMicroAndMacroTasks();

    expect(formLoadSpy).toHaveBeenCalledTimes(1);
  });
});
