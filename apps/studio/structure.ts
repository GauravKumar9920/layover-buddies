import type { StructureResolver } from 'sanity/structure';

export const detourStructure: StructureResolver = (S) =>
  S.list()
    .title('Detour content')
    .items([
      S.listItem().title('Layover guides').child(S.documentTypeList('guide').title('Layover guides')),
      S.listItem().title('Landing pages').child(S.documentTypeList('landingPage').title('Landing pages')),
      S.divider(),
      ...S.documentTypeListItems().filter(
        (item) => !['guide', 'landingPage'].includes(item.getId() || ''),
      ),
    ]);
