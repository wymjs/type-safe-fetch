@wymjs/type-safe-fetch
===

> 支持攔截器功能的類型安全與自動推導的 fetch

內部代碼很單純，就是將原生的 `fetch` 擴展 `request`, `response`, `error` 三個攔截器，其他與原生的 `fetch` 無任何不同

**最主要的功能是提供了 `fetch` 的類型安全規範類型**，也可以使用原生的 `fetch` 並覆蓋原生類型來使用

## 安裝

```shell
$ pnpm i @wymjs/type-safe-fetch

# 使用到 tool/params-and-body-parser 需安裝
$ pnpm i query-string
```

## 使用

> 這裡僅提供該庫的最佳實踐方式，詳細可查閱[此](https://github.com/twjw/react-admin-template/tree/main/src/service/fetch2)

```typescript
// 有些內容沒寫，不是很重要，需要了解完整請查閱上方連結倉庫
// @/service/fetch2/api-type/user.ts
import { TsFetchTemplateDefineApis } from '@wymjs/type-safe-fetch'
import { ApiResponse } from '@/service/fetch2/type.ts'

// 使用 namespace 將每個 api 路徑的響應區分開來
export namespace Login {
  export type Params = {
    expiredMinutes?: number
  }
  
  export type Body = {
    username: string
    password: string
  }

  // 定義 Response 時可以使用生成工具來處理，
  // 我是使用 Jetbrains 的 Json2ts 來生成
  // 將指標點到這裡後按下右鍵，生成的彈窗勾選 type
  // 然後 Root name 輸入 Response 後按下 generate 就可以生成好類型了
  export type Response = {
    token: string
  }
}

export namespace Profile {
  export type Response = {
    id: number
    name: string
  }
}

export type Apis = TsFetchTemplateDefineApis<{
  // key 為 api 路徑，規則為 {method}:{path}
  // vscode 使用重構可以替換所有用到這 key 的值(webstorm 本來也可以的QQ)
  'get:/api/user/profile': {
    // 響應類型，此為必填，用 ApiResponse 將 Response 包裹住
    // ApiResponse 為統一的 api 響應格式
    response: ApiResponse<Profile.Response>
  }
  
  'post:/api/user/login': {
    // headers, params, body 都可以綁定類型
    // 在 fetch2() 一參傳入對應的路徑時，
    // 將會自動推斷二參有沒有什麼必傳參數沒傳的
    params?: Login.Params
    body: Login.Body
    response: ApiResponse<Login.Response>
  }
  
  // 動態路由參數，使用 : 連接即可，後續使用 pathParams 替換
  'get:/api/user/:id': {
    // ...
  }
}>



// @/service/fetch2/index.ts
import { createTsFetch, TsFetchTemplate } from '@wymjs/type-safe-fetch'
import { createMockTool } from '@wymjs/type-safe-fetch/tool/mock'
import { createMethodUrlTool } from '@wymjs/type-safe-fetch/tool/method-url'
import { createPathParamsUrlTool } from '@wymjs/type-safe-fetch/tool/path-params-url'
import { createParamsAndBodyParserTool } from '@wymjs/type-safe-fetch/tool/params-and-body-parser'
import { createMergeSameRequestTool } from '@wymjs/type-safe-fetch/tool/merge-same-request'
import { createLogTool } from '@wymjs/type-safe-fetch/tool/log'
import { envConfig } from '~env-config'
import { ApiResponse, MyListenerRequestInit, MyRequestInit } from '@/service/fetch2/type.ts'
import { commonApiErrorResponse, commonApiResponse, passAuthRequest, checkApiPermission } from '@/service/fetch2/helper/watch.ts'

const isLocal = envConfig.vite.isLocal

const fetch2 = createTsFetch() as unknown as TsFetchTemplate<
  import('@/service/fetch2/api-type/user.ts').Apis,
  MyRequestInit
>

// vite 開發運行環境下支持 @wymjs/vite-mock-apis 的功能
const mockTool = createMockTool()
// 將路徑的方法轉換成 method，如：post:/api/hello
const methodUrlTool = createMethodUrlTool()
// 將路徑參數轉換成匹配的 pathParams key-value
// 比方說：fetch2('/api/user/:id', { pathParams: { id: '1' } })
const pathParamsUrlTool = createPathParamsUrlTool()
// 將 params 轉成 querystring 以及 body 自動轉成字串傳入
const paramsAndBodyParserTool = createParamsAndBodyParserTool()
// 合併相同路徑請求，可以迴圈 call 相同路徑的 api 確認是否只 call 一次 api
const mergeSameRequestTool = createMergeSameRequestTool<
  Error,
  MyListenerRequestInit,
  ApiResponse<any>
>()
// vite 開發運行環境下 log 響應值(可選)
const logTool = createLogTool<Error, MyListenerRequestInit, ApiResponse<any>>()

// request 攔截器：泛型為 req/return 的類型
fetch2.watch.request<MyListenerRequestInit>(req => {
  if (isLocal) mockTool.transform(req)

  req.originUrl = req.url
  mergeSameRequestTool.defer(req.originUrl, req)
  methodUrlTool.transform(req)
  pathParamsUrlTool.transform(req)
  passAuthRequest(req)
  paramsAndBodyParserTool.transform(req)

  return req
})

// response 攔截器：
//   泛型 1 為 req 的類型
//   泛型 2 為 res 的類型
//   泛型 3 為 return 的類型
fetch2.watch.response<
  MyListenerRequestInit,
  Response,
  ApiResponse<any> | Promise<ApiResponse<any>>
>(async (req, res) => {
  checkApiPermission(req, res)
  const _res = await commonApiResponse(req, res)

  if (isLocal) logTool.log(req, _res)
  mergeSameRequestTool.resolve(req.originUrl, _res)

  return _res
})

// 錯誤攔截器：有寫錯誤攔截的話，除非攔截器內寫到報錯，
// 不然 fetch2() 執行後絕不會出現錯誤，就不用 try/catch 來包裹
//   泛型 1 為 error 的類型
//   泛型 2 為 req 的類型
//   泛型 3 為 res/return 的類型
fetch2.watch.error<Error, MyListenerRequestInit, ApiResponse<any> | Promise<ApiResponse<any>>>(
  async (error, req, res) => {
    const mergeResponse = await mergeSameRequestTool.waiting(req.originUrl, req, error)

    if (mergeResponse !== undefined) return mergeResponse
    if (isLocal) logTool.error(error, req)

    return commonApiErrorResponse(error, req, res)
  },
)

export { fetch2 }



// 使用
// 當你輸入一參路徑時你將會發現 IDE 彈出下拉列出所有路徑
fetch2('post:/api/user/login', {
  // body 類型未錯將會報錯
  body: {
    username: 'admin',
    password: '0000',
  },
  // params 定義為可選，所以可以不傳
  // ... 其他參數跟原生的一樣
})

fetch2('get:/api/user/:id', {
  // 動態路由參數這樣替換
  pathParams: { id: '1' },
})
```
