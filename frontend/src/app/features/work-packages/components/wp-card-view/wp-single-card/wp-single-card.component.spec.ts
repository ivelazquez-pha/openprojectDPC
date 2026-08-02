import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { StateService, UIRouterGlobals } from '@uirouter/core';
import { PathHelperService } from 'core-app/core/path-helper/path-helper.service';
import { I18nService } from 'core-app/core/i18n/i18n.service';
import { TimezoneService } from 'core-app/core/datetime/timezone.service';
import { SchemaCacheService } from 'core-app/core/schemas/schema-cache.service';
import {
  WorkPackageViewSelectionService,
} from 'core-app/features/work-packages/routing/wp-view-base/view-services/wp-view-selection.service';
import {
  WorkPackageViewFocusService,
} from 'core-app/features/work-packages/routing/wp-view-base/view-services/wp-view-focus.service';
import {
  WorkPackageCardViewService,
} from 'core-app/features/work-packages/components/wp-card-view/services/wp-card-view.service';
import {
  KeepTabService,
} from 'core-app/features/work-packages/components/wp-single-view-tabs/keep-tab/keep-tab.service';
import { WorkPackageResource } from 'core-app/features/hal/resources/work-package-resource';
import { CardFieldConfig } from 'core-app/features/hal/resources/type-resource';
import {
  WorkPackageSingleCardComponent,
} from 'core-app/features/work-packages/components/wp-card-view/wp-single-card/wp-single-card.component';

function fieldConfig(fieldId:string, overrides:Partial<CardFieldConfig> = {}):CardFieldConfig {
  return {
    fieldId,
    zone: 'middle',
    color: null,
    backgroundColor: null,
    showLabel: true,
    ...overrides,
  };
}

function buildWorkPackage(overrides:Record<string, unknown> = {}):WorkPackageResource {
  return {
    id: '42',
    subject: 'Some subject',
    status: { name: 'New' },
    type: { id: '1', name: 'Bug' },
    project: { name: 'Demo project' },
    formattedId: '#42',
    displayId: '42',
    priority: { name: 'High' },
    ...overrides,
  } as unknown as WorkPackageResource;
}

describe('WorkPackageSingleCardComponent', () => {
  let fixture:ComponentFixture<WorkPackageSingleCardComponent>;
  let component:WorkPackageSingleCardComponent;
  let schemaCacheStub:{ state:ReturnType<typeof vi.fn>, of:ReturnType<typeof vi.fn> };

  function setup(schemaValues$ = of({})) {
    schemaCacheStub = {
      state: vi.fn(() => ({ values$: () => schemaValues$ })),
      of: vi.fn(() => ({
        ofProperty: (name:string) => (name === 'priority' ? { name: 'Priority' } : null),
      })),
    };

    TestBed.configureTestingModule({
      declarations: [WorkPackageSingleCardComponent],
      providers: [
        { provide: PathHelperService, useValue: {} },
        { provide: I18nService, useValue: { t: (key:string) => key } },
        { provide: StateService, useValue: {} },
        { provide: UIRouterGlobals, useValue: { params: {}, params$: of({}) } },
        {
          provide: WorkPackageViewSelectionService,
          useValue: { live$: () => of(null), isSelected: () => false },
        },
        { provide: WorkPackageViewFocusService, useValue: { updateFocus: () => undefined } },
        { provide: WorkPackageCardViewService, useValue: { classIdentifier: () => 'card-1', findRenderedCard: () => undefined } },
        { provide: TimezoneService, useValue: {} },
        { provide: SchemaCacheService, useValue: schemaCacheStub },
        { provide: KeepTabService, useValue: { currentShowHref: () => '/work_packages/42' } },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(WorkPackageSingleCardComponent);
    component = fixture.componentInstance;
    component.workPackage = buildWorkPackage();
  }

  describe('default behavior (non-board consumers: wp-grid, Team Planner, add-existing-pane)', () => {
    beforeEach(() => setup());

    it('defaults renderTypeCardFields to false', () => {
      expect(component.renderTypeCardFields).toBe(false);
    });

    it('renders no extra card fields even if a map were somehow provided', () => {
      component.typeCardFieldsByTypeId = { 1: [fieldConfig('priority')] };
      fixture.detectChanges();

      expect(component.extraCardFieldConfigs).toEqual([]);
    });
  });

  describe('board opt-in (renderTypeCardFields = true)', () => {
    it('renders no extra fields before the schema has resolved (gated as a whole, not per-field)', () => {
      // Schema never emits in this test -> state stays unresolved.
      setup(of());
      component.renderTypeCardFields = true;
      component.typeCardFieldsByTypeId = { 1: [fieldConfig('priority')] };
      fixture.detectChanges();

      expect(component.schemaLoaded).toBe(false);
      expect(component.extraCardFieldConfigs).toEqual([]);
    });

    it('resolves the OWN type\'s configured fields once the schema resolves', () => {
      setup();
      component.renderTypeCardFields = true;
      component.typeCardFieldsByTypeId = {
        1: [fieldConfig('priority')],
        2: [fieldConfig('assignee')],
      };
      fixture.detectChanges();

      expect(component.schemaLoaded).toBe(true);
      expect(component.extraCardFieldConfigs).toEqual([fieldConfig('priority')]);
    });

    it('renders each card according to its own type when Types are mixed on a board', () => {
      setup();
      component.renderTypeCardFields = true;
      component.typeCardFieldsByTypeId = {
        1: [fieldConfig('priority')],
        2: [fieldConfig('assignee')],
      };
      component.workPackage = buildWorkPackage({ type: { id: '2', name: 'Task' } });
      fixture.detectChanges();

      expect(component.extraCardFieldConfigs).toEqual([fieldConfig('assignee')]);
    });

    it('groups configured fields by zone', () => {
      setup();
      component.renderTypeCardFields = true;
      component.typeCardFieldsByTypeId = {
        1: [
          fieldConfig('priority', { zone: 'top' }),
          fieldConfig('assignee', { zone: 'middle' }),
          fieldConfig('category', { zone: 'footer' }),
        ],
      };
      fixture.detectChanges();

      expect(component.fieldsForZone('top')).toEqual([fieldConfig('priority', { zone: 'top' })]);
      expect(component.fieldsForZone('middle')).toEqual([fieldConfig('assignee', { zone: 'middle' })]);
      expect(component.fieldsForZone('footer')).toEqual([fieldConfig('category', { zone: 'footer' })]);
    });

    it('resolves a human-readable label from the loaded schema', () => {
      setup();
      component.renderTypeCardFields = true;
      fixture.detectChanges();

      expect(component.extraCardFieldLabel(component.workPackage, 'priority')).toBe('Priority');
    });

    it('falls back to the raw field identifier when the schema has no matching property', () => {
      setup();
      component.renderTypeCardFields = true;
      fixture.detectChanges();

      expect(component.extraCardFieldLabel(component.workPackage, 'not_a_real_field')).toBe('not_a_real_field');
    });

    it('renders a plain-text tooltip value, unwrapping HAL-like objects with a name', () => {
      setup();
      fixture.detectChanges();

      expect(component.extraCardFieldTooltip(component.workPackage, 'priority')).toBe('High');
      expect(component.extraCardFieldTooltip(component.workPackage, 'subject')).toBe('Some subject');
      expect(component.extraCardFieldTooltip(component.workPackage, 'missingField')).toBe('');
    });

    it('reports whether the work package actually has a value for a field, so an empty "-" placeholder is never colored', () => {
      setup();
      fixture.detectChanges();

      expect(component.hasFieldValue(component.workPackage, 'priority')).toBe(true);
      expect(component.hasFieldValue(component.workPackage, 'missingField')).toBe(false);
      expect(component.hasFieldValue(buildWorkPackage({ customField1: [] }), 'customField1')).toBe(false);
      expect(component.hasFieldValue(buildWorkPackage({ customField1: ['a'] }), 'customField1')).toBe(true);
      expect(component.hasFieldValue(buildWorkPackage({ notes: '' }), 'notes')).toBe(false);
      expect(component.hasFieldValue(buildWorkPackage({ notes: '  ' }), 'notes')).toBe(false);
      expect(component.hasFieldValue(buildWorkPackage({ percentageDone: 0 }), 'percentageDone')).toBe(true);
    });
  });
});
