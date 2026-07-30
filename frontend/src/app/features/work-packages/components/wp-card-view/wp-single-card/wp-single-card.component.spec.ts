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
import {
  WorkPackageSingleCardComponent,
} from 'core-app/features/work-packages/components/wp-card-view/wp-single-card/wp-single-card.component';

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

// Maps the Licitacion-only hardcoded label names to fake schema property
// keys, mirroring what `ISchemaProxy#attributeFromLocalizedName` would
// resolve to in a real schema for custom fields named this way.
const LICITACION_SCHEMA_FIELD_MAP:Record<string, string> = {
  Cliente: 'customField1',
  'Localidad / Provincia': 'customField2',
  'Nro de Contratacion': 'customField3',
  Gestion: 'customField4',
  Etiquetas: 'customField5',
};

describe('WorkPackageSingleCardComponent', () => {
  let fixture:ComponentFixture<WorkPackageSingleCardComponent>;
  let component:WorkPackageSingleCardComponent;
  let schemaCacheStub:{ state:ReturnType<typeof vi.fn>, of:ReturnType<typeof vi.fn> };

  function setup(schemaValues$ = of({})) {
    schemaCacheStub = {
      state: vi.fn(() => ({ values$: () => schemaValues$ })),
      of: vi.fn(() => ({
        ofProperty: (name:string) => (name === 'priority' ? { name: 'Priority' } : null),
        attributeFromLocalizedName: (name:string) => LICITACION_SCHEMA_FIELD_MAP[name] ?? null,
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
      component.typeCardFieldsByTypeId = { 1: ['priority'] };
      fixture.detectChanges();

      expect(component.extraCardFieldIds).toEqual([]);
    });
  });

  describe('board opt-in (renderTypeCardFields = true)', () => {
    it('renders no extra fields before the schema has resolved (gated as a whole, not per-field)', () => {
      // Schema never emits in this test -> state stays unresolved.
      setup(of());
      component.renderTypeCardFields = true;
      component.typeCardFieldsByTypeId = { 1: ['priority'] };
      fixture.detectChanges();

      expect(component.schemaLoaded).toBe(false);
      expect(component.extraCardFieldIds).toEqual([]);
    });

    it('resolves the OWN type\'s configured fields once the schema resolves', () => {
      setup();
      component.renderTypeCardFields = true;
      component.typeCardFieldsByTypeId = {
        1: ['priority'],
        2: ['assignee'],
      };
      fixture.detectChanges();

      expect(component.schemaLoaded).toBe(true);
      expect(component.extraCardFieldIds).toEqual(['priority']);
    });

    it('renders each card according to its own type when Types are mixed on a board', () => {
      setup();
      component.renderTypeCardFields = true;
      component.typeCardFieldsByTypeId = {
        1: ['priority'],
        2: ['assignee'],
      };
      component.workPackage = buildWorkPackage({ type: { id: '2', name: 'Task' } });
      fixture.detectChanges();

      expect(component.extraCardFieldIds).toEqual(['assignee']);
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
  });

  // HARDCODED, INTENTIONALLY NON-SCALABLE SPECIAL CASE for Type "Licitacion"
  // board cards only. Not a generic per-type configuration system — see
  // wp-single-card.component.ts for the rationale. Do not generalize this
  // without checking with the user first.
  describe('Licitacion type special case', () => {
    it('is only active when the Type name is exactly "Licitacion"', () => {
      setup();
      component.workPackage = buildWorkPackage({ type: { id: '9', name: 'Licitacion' } });
      fixture.detectChanges();

      expect(component.isLicitacionType(component.workPackage)).toBe(true);
    });

    it('does not activate for any other Type name', () => {
      setup();
      component.renderTypeCardFields = true;
      component.workPackage = buildWorkPackage({ type: { id: '1', name: 'Task' } });
      fixture.detectChanges();

      expect(component.isLicitacionType(component.workPackage)).toBe(false);
      expect(component.licitacionLabelFields).toEqual([]);
      expect(component.licitacionTags).toEqual([]);
    });

    it('renders all four label rows when all four fields are populated', () => {
      setup();
      component.renderTypeCardFields = true;
      component.workPackage = buildWorkPackage({
        type: { id: '9', name: 'Licitacion' },
        customField1: 'Acme Corp',
        customField2: 'Buenos Aires',
        customField3: '1234/2026',
        customField4: 'En curso',
      });
      fixture.detectChanges();

      expect(component.licitacionLabelFields).toEqual([
        { label: 'Cliente', fieldId: 'customField1' },
        { label: 'Localidad / Provincia', fieldId: 'customField2' },
        { label: 'Nro de Contratacion', fieldId: 'customField3' },
        { label: 'Gestion', fieldId: 'customField4' },
      ]);
    });

    it('renders only the non-empty label rows, omitting empty/null fields entirely', () => {
      setup();
      component.renderTypeCardFields = true;
      component.workPackage = buildWorkPackage({
        type: { id: '9', name: 'Licitacion' },
        customField1: 'Acme Corp',
        customField2: '',
        customField3: null,
        // customField4 (Gestion) intentionally absent
      });
      fixture.detectChanges();

      expect(component.licitacionLabelFields).toEqual([
        { label: 'Cliente', fieldId: 'customField1' },
      ]);
    });

    it('renders no label rows when every field is empty', () => {
      setup();
      component.renderTypeCardFields = true;
      component.workPackage = buildWorkPackage({
        type: { id: '9', name: 'Licitacion' },
        customField1: '',
        customField2: null,
        customField3: undefined,
      });
      fixture.detectChanges();

      expect(component.licitacionLabelFields).toEqual([]);
    });

    it('resolves Etiquetas tag names from a HAL-collection-shaped ("elements") custom field value', () => {
      setup();
      component.renderTypeCardFields = true;
      component.workPackage = buildWorkPackage({
        type: { id: '9', name: 'Licitacion' },
        customField5: { elements: [{ name: 'MUESTRA' }, { name: 'GARANTIA' }] },
      });
      fixture.detectChanges();

      expect(component.licitacionTags).toEqual(['MUESTRA', 'GARANTIA']);
    });

    it('yields no tags when Etiquetas has no value', () => {
      setup();
      component.renderTypeCardFields = true;
      component.workPackage = buildWorkPackage({
        type: { id: '9', name: 'Licitacion' },
      });
      fixture.detectChanges();

      expect(component.licitacionTags).toEqual([]);
    });

    it('assigns the same color to the same tag text every time (deterministic)', () => {
      setup();
      component.renderTypeCardFields = true;
      fixture.detectChanges();

      const first = component.tagColor('MUESTRA');
      const second = component.tagColor('MUESTRA');

      expect(first).toBe(second);
    });

    it('always picks a color from the fixed palette', () => {
      setup();
      component.renderTypeCardFields = true;
      fixture.detectChanges();

      const palette = [
        '#61bd4f', '#f2d600', '#ff9f1a', '#eb5a46', '#0079bf', '#c377e0',
      ];

      ['MUESTRA', 'GARANTIA', 'URGENTE', 'REVISAR', 'NUEVO'].forEach((tag) => {
        expect(palette).toContain(component.tagColor(tag));
      });
    });

    it('leaves the generic type-fields mechanism completely unaffected for a non-Licitacion Type (regression check)', () => {
      setup();
      component.renderTypeCardFields = true;
      component.typeCardFieldsByTypeId = { 1: ['priority'] };
      component.workPackage = buildWorkPackage({ type: { id: '1', name: 'Task' } });
      fixture.detectChanges();

      expect(component.isLicitacionType(component.workPackage)).toBe(false);
      expect(component.extraCardFieldIds).toEqual(['priority']);
      expect(component.licitacionLabelFields).toEqual([]);
      expect(component.licitacionTags).toEqual([]);
    });
  });
});
