export { normalizeQuery, normalizeText, stemNl, normalizeForIndex, expandSynonyms, synonymVariants } from './normalize';
export type { NormalizedQuery } from './normalize';

export { nevoSource, loadNevo, nevoHeader, isNevoLoaded, rowToFoodItem, __setNevoDataForTest } from './nevo';
export type { NevoRow, NevoFile, NevoHeader } from './nevo-format';
export { NEVO_ROW_LENGTH } from './nevo-format';

export { userFoodsSource, recipesSource, recipeToFoodItem } from './user';

export { searchFoods, getFoodById, registerFoodSource, unregisterFoodSource, getRegisteredSources } from './search';
