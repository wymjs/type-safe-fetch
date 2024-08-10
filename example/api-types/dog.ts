import { TsFetchTemplateDefineApis } from '@wymjs/type-safe-fetch'

export type Apis = TsFetchTemplateDefineApis<{
	'get:/dog': { response: never }
}>
