import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { I18nService } from 'core-app/core/i18n/i18n.service';
import { States } from 'core-app/core/states/states.service';
import { OpenprojectHalModule } from 'core-app/features/hal/openproject-hal.module';
import { HalResourceService } from 'core-app/features/hal/services/hal-resource.service';
import { QuerySortByResource } from 'core-app/features/hal/resources/query-sort-by-resource';
import {
  canSortBoard,
  unionSortableFields,
  isAssociationBackedField,
  toQueryFieldName,
} from 'core-app/features/boards/board/board-sort/board-sort-field';

function sortBy(id:string, name:string, direction = 'asc'):QuerySortByResource {
  return {
    column: { id, name, href: `/api/v3/queries/columns/${id}` },
    direction: { href: `urn:openproject-org:api:v3:queries:directions:${direction}` },
  } as unknown as QuerySortByResource;
}

/**
 * Builds a `QuerySortByResource` the way the REAL
 * `POST /api/v3/queries/:id/form` response actually shapes it (confirmed via
 * live Network tab capture on a real status board): `column` is exposed
 * ONLY as a `_links.column` reference, never `_embedded`. This is the exact
 * shape that exposed the "Sort by..." always-empty regression - a plain
 * object literal fixture (like `sortBy()` above) hides this bug entirely
 * because it never exercises `HalResource#id`'s numeric-only href fallback.
 */
function realApiSortByFixture(halResourceService:HalResourceService, columnId:string, columnTitle:string, direction:'asc'|'desc' = 'asc'):QuerySortByResource {
  return halResourceService.createHalResource<QuerySortByResource>({
    _type: 'QuerySortBy',
    id: `${columnId}-${direction}`,
    name: `${columnTitle} (${direction === 'asc' ? 'Ascendente' : 'Descendente'})`,
    _links: {
      self: { href: `/api/v3/queries/sort_bys/${columnId}-${direction}`, title: columnTitle },
      column: { href: `/api/v3/queries/columns/${columnId}`, title: columnTitle },
      direction: { href: `urn:openproject-org:api:v3:queries:directions:${direction}`, title: direction },
    },
  }, true);
}

describe('board-sort-field', () => {
  describe('unionSortableFields', () => {
    it('returns the union of fields sortable across all columns', () => {
      const columnA = [sortBy('subject', 'Subject'), sortBy('dueDate', 'Finish date')];
      const columnB = [sortBy('subject', 'Subject'), sortBy('startDate', 'Start date')];

      expect(unionSortableFields([columnA, columnB])).toEqual([
        { id: 'dueDate', name: 'Finish date' },
        { id: 'startDate', name: 'Start date' },
        { id: 'subject', name: 'Subject' },
      ]);
    });

    it('offers a field that is sortable in only one of several columns', () => {
      const columnA = [sortBy('subject', 'Subject'), sortBy('dueDate', 'Finish date')];
      const columnB = [sortBy('subject', 'Subject')];

      const result = unionSortableFields([columnA, columnB]);

      expect(result.map((field) => field.id)).toContain('dueDate');
    });

    it('excludes a field that is sortable in zero columns', () => {
      const columnA = [sortBy('subject', 'Subject')];
      const columnB = [sortBy('subject', 'Subject')];

      const result = unionSortableFields([columnA, columnB]);

      expect(result.map((field) => field.id)).not.toContain('dueDate');
    });

    it('excludes manual sorting and the hierarchy parent pseudo-column', () => {
      const columnA = [
        sortBy('subject', 'Subject'),
        { column: { id: undefined, name: 'Manual', href: '/api/v3/queries/columns/manualSorting' }, direction: { href: 'asc' } } as unknown as QuerySortByResource,
        { column: { id: 'parent', name: 'Parent', href: '/api/v3/queries/columns/parent' }, direction: { href: 'asc' } } as unknown as QuerySortByResource,
      ];
      const columnB = [sortBy('subject', 'Subject')];

      const result = unionSortableFields([columnA, columnB]);

      expect(result).toEqual([{ id: 'subject', name: 'Subject' }]);
    });

    it('excludes known association-backed fields even when reported sortable by every column', () => {
      const columnA = [sortBy('subject', 'Subject'), sortBy('status', 'Status'), sortBy('assignee', 'Assignee')];
      const columnB = [sortBy('subject', 'Subject'), sortBy('status', 'Status'), sortBy('assignee', 'Assignee')];

      const result = unionSortableFields([columnA, columnB]);

      expect(result).toEqual([{ id: 'subject', name: 'Subject' }]);
    });

    it('returns an empty list when there are no columns', () => {
      expect(unionSortableFields([])).toEqual([]);
    });

    it('sorts the result alphabetically by display name', () => {
      const columnA = [sortBy('dueDate', 'Finish date'), sortBy('subject', 'Subject')];
      const columnB = [sortBy('dueDate', 'Finish date'), sortBy('subject', 'Subject')];

      const result = unionSortableFields([columnA, columnB]);

      expect(result.map((field) => field.name)).toEqual(['Finish date', 'Subject']);
    });
  });

  /**
   * REGRESSION: "Sort by..." reported "No field is sortable on any list of
   * this board" for EVERY field (including plain, always-sortable ones like
   * due date) on a real status board, despite `POST /api/v3/queries/:id/form`
   * returning 200 OK with a rich, non-empty `sortBy.allowedValues` array
   * (confirmed via live Network tab capture).
   *
   * Root cause: `unionSortableFields` read `sort.column.id`. In the real API
   * response `column` is only ever a `_links.column` reference (`{ href,
   * title }`), never `_embedded`. Once hydrated into a real `HalResource`,
   * `id` falls back to parsing the href - but that generic fallback only
   * accepts purely numeric trailing segments, and query column identifiers
   * (`startDate`, `customField1`, ...) are alphanumeric, so `.id` was always
   * `null`. Every field was therefore silently dropped by `if (!id) return`,
   * regardless of board type, column count, or field kind.
   *
   * This spec builds fixtures through the REAL `HalResourceService` from raw
   * JSON matching the exact captured API shape (not a plain object literal
   * with a hand-set `.id`), so it exercises the actual `HalResource#id`
   * fallback that caused the bug - reverting the `href`-based fix in
   * `unionSortableFields` makes this fail again.
   */
  describe('unionSortableFields against the real API response shape (regression)', () => {
    let halResourceService:HalResourceService;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [OpenprojectHalModule],
        providers: [
          HalResourceService,
          States,
          I18nService,
          provideHttpClient(withInterceptorsFromDi()),
          provideHttpClientTesting(),
        ],
      }).compileComponents();

      halResourceService = TestBed.inject(HalResourceService);
    });

    it('offers plain fields (e.g. due date) whose column is only ever a _links reference, never embedded', () => {
      const columnA = [
        realApiSortByFixture(halResourceService, 'dueDate', 'Fecha de fin'),
        realApiSortByFixture(halResourceService, 'startDate', 'Fecha de inicio'),
      ];

      const result = unionSortableFields([columnA]);

      expect(result).toEqual([
        { id: 'dueDate', name: 'Fecha de fin' },
        { id: 'startDate', name: 'Fecha de inicio' },
      ]);
    });

    it('offers a real custom field sortable via the same link-only column shape', () => {
      const columnA = [realApiSortByFixture(halResourceService, 'customField1', 'My Custom Field')];

      const result = unionSortableFields([columnA]);

      expect(result).toEqual([{ id: 'customField1', name: 'My Custom Field' }]);
    });

    it('still excludes association-backed fields and manual sorting once hydrated as real HalResources', () => {
      const columnA = [
        realApiSortByFixture(halResourceService, 'status', 'Status'),
        realApiSortByFixture(halResourceService, 'assignee', 'Assignee'),
        realApiSortByFixture(halResourceService, 'manualSorting', 'Manual'),
        realApiSortByFixture(halResourceService, 'subject', 'Subject'),
      ];

      const result = unionSortableFields([columnA]);

      expect(result).toEqual([{ id: 'subject', name: 'Subject' }]);
    });
  });

  describe('isAssociationBackedField', () => {
    it('flags well-known association-backed attributes', () => {
      expect(isAssociationBackedField('status')).toBe(true);
      expect(isAssociationBackedField('assignee')).toBe(true);
    });

    it('does not flag plain attributes', () => {
      expect(isAssociationBackedField('subject')).toBe(false);
      expect(isAssociationBackedField('dueDate')).toBe(false);
    });
  });

  describe('toQueryFieldName', () => {
    it('applies the generic camelCase -> snake_case rule for plain attributes', () => {
      expect(toQueryFieldName('dueDate')).toBe('due_date');
      expect(toQueryFieldName('startDate')).toBe('start_date');
      expect(toQueryFieldName('subject')).toBe('subject');
      expect(toQueryFieldName('id')).toBe('id');
    });

    it('applies the well-known special-case conversions', () => {
      expect(toQueryFieldName('assignee')).toBe('assigned_to');
      expect(toQueryFieldName('percentageDone')).toBe('done_ratio');
      expect(toQueryFieldName('estimatedTime')).toBe('estimated_hours');
      expect(toQueryFieldName('remainingTime')).toBe('remaining_hours');
      expect(toQueryFieldName('spentTime')).toBe('spent_hours');
    });

    // Post-deploy bug: a real custom field (API id `customField1`) failed
    // board sort with a 422 `invalid_field`. Root cause: the generic
    // camelCase -> snake_case rule turned `customField1` into
    // `custom_field1`, but `Boards::BoardOrderService`/`CustomField#column_name`
    // (backend) and `API::Utilities::PropertyNameConverter#collapse_custom_field_name`
    // both expect the short form `cf_<id>` (see
    // `app/services/api/v3/parse_query_params_service.rb`'s own documented
    // example: "customField1 => cf_1"). Every column's `plain_sortable_column`
    // match therefore failed for every board, on every custom field, always.
    it('converts custom field API ids to their backend cf_<id> column name', () => {
      expect(toQueryFieldName('customField1')).toBe('cf_1');
      expect(toQueryFieldName('customField42')).toBe('cf_42');
    });
  });

  describe('canSortBoard', () => {
    it('is true when every column authorizes reorder', () => {
      expect(canSortBoard([true, true])).toBe(true);
    });

    it('is false when any column lacks reorder authorization', () => {
      expect(canSortBoard([true, false])).toBe(false);
    });

    it('is false when there are no columns at all', () => {
      expect(canSortBoard([])).toBe(false);
    });
  });
});
