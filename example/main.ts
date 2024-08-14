import { createTsFetch, TsFetchTemplate } from '@wymjs/type-safe-fetch'
import { Apis as CatApis } from './api-types/cat.ts'
import { Apis as DogApis } from './api-types/dog.ts'
import { createMethodUrlTool } from '@wymjs/type-safe-fetch/tool/method-url'
import { createPathParamsUrlTool } from '@wymjs/type-safe-fetch/tool/path-params-url'
import { createParamsAndBodyParserTool } from '@wymjs/type-safe-fetch/tool/params-and-body-parser'

console.clear()

const root = document.getElementById('root')!
root.innerHTML = `
<h1 style="text-align:center;">hello @wymjs/type-safe-fetch!</h1>
<div id="fetch-result"></div>
`

const apiPrefix = 'https://api.thecatapi.com'

const fetch2 = createTsFetch() as unknown as TsFetchTemplate<CatApis & DogApis>
const methodUrlTool = createMethodUrlTool()
const pathParamsUrlTool = createPathParamsUrlTool()
const paramsAndBodyParserTool = createParamsAndBodyParserTool()

fetch2.watch.request(async req => {
	methodUrlTool.transform(req)
	pathParamsUrlTool.transform(req)
	paramsAndBodyParserTool.transform(req)

	console.log('等待開始...')
	await new Promise<void>(resolve => {
		setTimeout(() => {
			resolve()
		}, 1000)
	})
	console.log('等待結束')

	return {
		...req,
		url: `${apiPrefix}${req.url[0] === '/' ? '' : '/'}${req.url}`,
	}
})

fetch2.watch.response((req, res) => {
	return res.json()
})

fetch2.watch.error((error, req) => {
	console.error(error)
	return req.url
})
;(async () => {
	const resultNode: HTMLElement = root.querySelector('#fetch-result')!
	resultNode.style.display = 'flex'
	resultNode.style.flexDirection = 'column'
	resultNode.style.alignItems = 'center'
	resultNode.style.justifyContent = 'center'

	resultNode.innerHTML = 'fetching ...'

	const res = await fetch2('get:/:version/images/search', {
		pathParams: {
			version: 'v1',
		},
		params: {
			size: 'med',
			mime_types: 'jpg',
			format: 'json',
			has_breeds: true,
			order: 'RANDOM',
			page: 0,
			limit: 1,
		},
	})

	resultNode.innerHTML = `
    <div>${JSON.stringify(res)}</div>
    <img src="${res[0].url}" style="width:200px;" /> 
  `
})()
