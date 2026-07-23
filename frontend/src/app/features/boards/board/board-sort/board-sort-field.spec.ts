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
