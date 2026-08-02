import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { ApiV3Service } from 'core-app/core/apiv3/api-v3.service';
import { ApiV3FilterBuilder } from 'core-app/shared/helpers/api-v3/api-v3-filter-builder';
import { BoardCardFieldsService } from 'core-app/features/boards/board/board-card-fields/board-card-fields.service';
import { CardFieldConfig } from 'core-app/features/hal/resources/type-resource';

function fieldConfig(fieldId:string):CardFieldConfig {
  return {
    fieldId, zone: 'middle', color: null, backgroundColor: null, showLabel: true,
  };
}

describe('BoardCardFieldsService', () => {
  let getPaginatedResultsSpy:ReturnType<typeof vi.fn>;
  let filteredSpy:ReturnType<typeof vi.fn>;
  let service:BoardCardFieldsService;

  function configure(types:{ id:string, boardCardFields?:CardFieldConfig[] }[]) {
    getPaginatedResultsSpy = vi.fn(() => of(types));
    filteredSpy = vi.fn(() => ({ getPaginatedResults: getPaginatedResultsSpy }));

    const apiV3ServiceStub = {
      types: {
        filtered: filteredSpy,
      },
    };

    TestBed.configureTestingModule({
      providers: [
        BoardCardFieldsService,
        { provide: ApiV3Service, useValue: apiV3ServiceStub },
      ],
    });

    service = TestBed.inject(BoardCardFieldsService);
  }

  it('builds a typeId -> configured field configs map from the globally fetched types', async () => {
    configure([
      { id: '1', boardCardFields: [fieldConfig('priority'), fieldConfig('assignee')] },
      { id: '2', boardCardFields: [] },
    ]);

    const map = await firstValueFrom(service.map$());

    expect(map).toEqual({
      1: [fieldConfig('priority'), fieldConfig('assignee')],
      2: [],
    });
  });

  it('defaults to an empty array when a type has no boardCardFields set', async () => {
    configure([{ id: '3' }]);

    const map = await firstValueFrom(service.map$());

    expect(map).toEqual({ 3: [] });
  });

  it('fetches types without any project-scoping filter (global lookup)', async () => {
    configure([{ id: '1', boardCardFields: [] }]);

    await firstValueFrom(service.map$());

    expect(filteredSpy).toHaveBeenCalledTimes(1);
    const filtersArg = filteredSpy.mock.calls[0][0] as ApiV3FilterBuilder;
    // An empty ApiV3FilterBuilder must not carry any project/board filter.
    expect(filtersArg).toBeInstanceOf(ApiV3FilterBuilder);
    expect(filtersArg.filters).toEqual([]);
  });

  it('caches the request: only fetches types once across multiple subscribers', async () => {
    configure([{ id: '1', boardCardFields: [fieldConfig('priority')] }]);

    await firstValueFrom(service.map$());
    await firstValueFrom(service.map$());

    expect(filteredSpy).toHaveBeenCalledTimes(1);
    expect(getPaginatedResultsSpy).toHaveBeenCalledTimes(1);
  });
});
