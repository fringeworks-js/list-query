# @fringeworks/list-query

`@fringeworks/list-query` は、一覧の絞り込みの関数と並べ替えの比較の関数を、関数でもデータ（JSON）でも組み立てられる、誰かにとっては便利なライブラリです。
列ごとのフィルターや複数のキーの並べ替えのように、画面や設定が作る条件を、そのまま `Array.prototype.filter`・`Array.prototype.sort` に渡せる関数にします。

**[English README is available here](./README.md)**

## 特徴

- **データでも関数でも**: 条件を JSON にできる形で書けるので、画面の状態や設定ファイルからそのまま作れます。データで書けないものは、同じ所に関数を書けます
- **列の名前をキーにする絞り込み**: `{ status: 'active', price: { '>=': 1000 } }` のように、列ごとに条件を書きます。配列は「どれか」（OR）、1つのオブジェクトに並べたものは「すべて」（AND）です
- **組み合わせ**: `$and`・`$or`・`$not` で、別々のところから来た条件を、上書きせずにまとめられます
- **並べ替え**: 複数のキー、昇順・降順、nullish の値の位置、`Intl.Collator` による文字列の比べ方を指定できます
- **値の一覧にも**: `number[]`・`string[]` も絞り込み・並べ替えできます
- **どこでも動く**: ECMAScript の標準だけを使います。`@fringeworks/state-model` の派生モデルの `filter`・`sort` にも、そのまま渡せます

## インストール

```sh
npm install @fringeworks/list-query
```

## 使い方

```ts
import { createFilter, createSort } from '@fringeworks/list-query';

const visible = products
  .filter(
    createFilter({ status: ['active', 'pending'], price: { '>=': 1000 } }),
  )
  .sort(createSort([{ key: 'status' }, { key: 'price', direction: 'desc' }]));
```

### 絞り込み

キーは列のパス、値はその列の条件です。すべての列に合うものを残します。

```ts
createFilter({
  status: ['active', 'pending'], // 配列は、どれかに合うもの（OR）
  name: { startsWith: 'Pen', endsWith: 'il' }, // 1つのオブジェクトに並べた演算子は、すべてに合うもの（AND）
  price: { '>=': 1000, '<=': 5000 },
  'address.city': 'Tokyo', // . でつないだパスは、ネストした値
});
```

列の条件には、次のものを書けます。

| 条件                            | 意味                                                               |
| ------------------------------- | ------------------------------------------------------------------ |
| 文字列・数値・真偽値・`bigint`  | 等しい（文字列は `ignoreCase`・`normalize` が効く）                |
| `null`                          | 値が `null` か `undefined`（列が無い）                             |
| `Date`                          | 時刻が等しい                                                       |
| `RegExp`                        | 正規表現に一致する（`g` フラグでも結果が変わらない）               |
| 演算子のオブジェクト            | すべての演算子に合う（AND）。演算子が1つも無ければ何にも一致しない |
| 配列                            | どれかに合う（OR）。空の配列は何にも一致しない                     |
| 関数 `(value, item) => boolean` | 真を返したときに一致する                                           |

演算子は、`ComparisonOperator` の値です（`@fringeworks/utils` の定数を、このパッケージから export したもの）。

| 演算子                                                  | 意味                                                                |
| ------------------------------------------------------- | ------------------------------------------------------------------- |
| `'==='`・`'!=='`・`'=='`・`'!='`                        | 等しい・等しくない                                                  |
| `'>'`・`'>='`・`'<'`・`'<='`                            | 大小（JavaScript の比較演算子のまま）                               |
| `between`・`notBetween`                                 | 範囲 `[min, max]`（両端を含む。下限が上限より大きければ入れ替える） |
| `oneOf`・`notOneOf`                                     | 候補のどれかと等しい・どれとも等しくない                            |
| `includes`・`notIncludes`・`includesAll`・`includesAny` | 文字列の部分一致・配列の要素                                        |
| `startsWith`・`endsWith`                                | 前方一致・後方一致                                                  |
| `matches`                                               | 正規表現（文字列で書ける。正規表現として不正なら一致しない）        |
| `deepEqual`・`notDeepEqual`                             | 構造が等しい・等しくない                                            |

- 知らない名前の演算子は無視します
- 列の値が無い（`undefined`）ときの判定は、JavaScript の比較に任せます（`undefined >= 1000` は偽、`'!=='` は真）
- 値が `undefined` の列は、指定しなかったものとして扱います

### 条件の組み合わせ

```ts
// 配列は、どれかに合うもの（OR）
createFilter([{ status: 'archived' }, { price: { '<': 200 } }]);

// 別々のところから来た条件をまとめる（スプレッドで重ねると、同じ列の条件が上書きされる）
createFilter({ $and: [systemFilter, userFilter] });

// 別の列にまたがる OR を、AND の中に入れる
createFilter({
  status: 'active',
  $or: [{ price: { '>=': 1000 } }, { stock: 0 }],
});

// 条件のまとまりを否定する
createFilter({ $not: { price: { '>=': 1000 }, stock: 0 } });

// 関数も混ぜられる
createFilter({ $and: [{ status: 'active' }, (item) => item.lines.length > 0] });
```

| 条件                  | 意味                                     |
| --------------------- | ---------------------------------------- |
| `{}`・`{ $and: [] }`  | すべてに一致する（絞り込まない）         |
| `[]`・`{ $or: [] }`   | 何にも一致しない                         |
| 列の条件の `{}`・`[]` | 何にも一致しない（比べ方を書いていない） |

列フィルターの条件をすべて外すと `{}` になり、一覧はすべて残ります。

### 文字列の比べ方

```ts
createFilter({ name: { includes: 'pen' } }, { ignoreCase: true });
createFilter(
  { name: 'ペン' },
  { normalize: (value) => value.normalize('NFKC') },
);
```

`ignoreCase`・`normalize` は、両方が文字列のときの、等しいか（列の条件の文字列・`'==='`・`'!=='`・`oneOf`・`notOneOf`）・部分一致・前方一致・後方一致・正規表現に効きます。大小の比較（`'>'` など）には効きません。

### 並べ替え

```ts
createSort(); // 要素そのものの昇順
createSort('name'); // 列の昇順
createSort({ key: 'price', direction: 'desc' });
createSort([{ key: 'status' }, { key: 'price', direction: 'desc' }]); // 優先する順に並べたキー
createSort({ key: (item) => item.lines.length }); // 計算した値で並べる
createSort((a, b) => a.price - b.price); // 比較の関数
```

| 値                                        | 比べ方                                       |
| ----------------------------------------- | -------------------------------------------- |
| 数値・`bigint`                            | 大小                                         |
| 文字列                                    | `Intl.Collator`                              |
| 真偽値                                    | `false` が先                                 |
| `Date`                                    | 時刻                                         |
| `null`・`undefined`・`NaN`・不正な `Date` | 向きに関係なく、`nulls` の位置（既定は末尾） |

- 前のキーで同じ順位なら、次のキーで比べます。すべて同じなら元の順を保ちます（`Array.prototype.sort` は安定です）
- 種類の違う値が混ざったときは、数値・文字列・真偽値・`Date`・そのほかの順に並べます
- 文字列の比べ方は、`locale`・`numeric`・`sensitivity`・`caseFirst`・`ignorePunctuation`（`Intl.Collator` と同じ名前）で指定できます。2つ目の引数に書くと全体に効き、キーごとのオブジェクトに書くとそのキーだけに効きます

```ts
createSort('name', { locale: 'ja', numeric: true });
createSort([{ key: 'code', numeric: true }, { key: 'name' }], { locale: 'ja' });
```

### ネストした値と特別な列の名前

列のパスは、`@fringeworks/utils` の `parsePropertyPath` の規則で読みます。

```ts
createFilter({ 'address.city': 'Tokyo' }); // ネストした値
createFilter({ 'lines[0].price': { '>': 0 } }); // 配列の添字
createFilter({ '["a.b"]': 1, '["$price"]': { '>': 10 } }); // . や $ を含むキーは、引用符で囲む
createSort({ key: ['address', 'city'] }); // 並べ替えでは、キーの配列も使える
```

`$` で始まるキーは特別なキー（`$and`・`$or`・`$not`・`$value`）です。`$` で始まる列は、引用符で囲んで書きます。

### 値の一覧

```ts
[5, 10, 20].filter(createFilter<number>({ $value: { '>=': 10 } })); // [10, 20]
names.sort(createSort({ locale: 'ja' }));
```

### データで持つ

条件は JSON にできる形（`FilterSpec`・`SortSpec`）で書けるので、URL・保存した設定・サーバーから受け取ったものをそのまま渡せます。

```ts
const filter: FilterSpec = JSON.parse(saved.filter);
const sort: SortSpec = JSON.parse(saved.sort);
const visible = createDerivedList(lines, {
  filter: createFilter(filter),
  sort: createSort(sort),
});
```

### 型

`createFilter<T>`・`createSort<T>` に要素の型を渡すと、列の名前が補完され、列ごとの関数の引数に型が付きます。JSON から読んだ条件（`FilterSpec`・`SortSpec`）も受け付けるため、列の名前の書き間違いは型では見つけられません。

## API

| 関数                                | 説明                                                       |
| ----------------------------------- | ---------------------------------------------------------- |
| `createFilter(condition, options?)` | 絞り込みの条件から、要素が条件に合うかを判定する関数を作る |
| `createSort(condition?, options?)`  | 並べ替えの条件から、比較の関数を作る                       |

### `createFilter`

```ts
createFilter<T>(
  condition: FilterCondition<T> | FilterSpec,
  options?: CreateFilterOptions,
): FilterFunction<T>
```

絞り込みの条件から、要素が条件に合うかを判定する関数を作ります。条件は作るときに1回だけ解釈します。

| 引数        | 型                                 | 説明             |
| ----------- | ---------------------------------- | ---------------- |
| `condition` | `FilterCondition<T> \| FilterSpec` | 絞り込みの条件   |
| `options?`  | `CreateFilterOptions`              | 下記のオプション |

| オプション    | 型                          | 説明                                         |
| ------------- | --------------------------- | -------------------------------------------- |
| `ignoreCase?` | `boolean`                   | 大文字・小文字を区別しない（既定は `false`） |
| `normalize?`  | `(value: string) => string` | 比べる前に文字列を正規化する関数             |

### `createSort`

```ts
createSort<T>(
  condition?: SortCondition<T>,
  options?: CreateSortOptions,
): SortFunction<T>
```

並べ替えの条件から、比較の関数を作ります。条件を省くと要素そのものの昇順です。条件と `Intl.Collator` は、作るときに1回だけ用意します。

| 引数         | 型                  | 説明                                       |
| ------------ | ------------------- | ------------------------------------------ |
| `condition?` | `SortCondition<T>`  | 並べ替えの条件                             |
| `options?`   | `CreateSortOptions` | 下記のオプション。キーごとの指定が優先する |

| オプション           | 型                                    | 説明                                           |
| -------------------- | ------------------------------------- | ---------------------------------------------- |
| `nulls?`             | `'first' \| 'last'`                   | nullish の値を置く位置（既定は `'last'`）      |
| `locale?`            | `string \| readonly string[]`         | 文字列を比べるロケール（既定は実行環境の既定） |
| `numeric?`           | `boolean`                             | 数字の並びを数として比べる（既定は `false`）   |
| `sensitivity?`       | `Intl.CollatorOptions['sensitivity']` | 文字列のどの違いを区別するか                   |
| `caseFirst?`         | `Intl.CollatorOptions['caseFirst']`   | 大文字と小文字のどちらを先にするか             |
| `ignorePunctuation?` | `boolean`                             | 句読点を無視する（既定は `false`）             |

並べ替えのキーのオブジェクト（`SortItem<T>`）は、上のオプションに加えて次のものを持ちます。

| プロパティ   | 型                | 説明                                                                       |
| ------------ | ----------------- | -------------------------------------------------------------------------- |
| `key?`       | `SortKey<T>`      | 列のパス（文字列・キーの配列）か、値を取り出す関数。省略すると要素そのもの |
| `direction?` | `'asc' \| 'desc'` | 向き（既定は `'asc'`）                                                     |

### 定数

| 定数                 | 説明                                      |
| -------------------- | ----------------------------------------- |
| `ComparisonOperator` | 演算子の値（`@fringeworks/utils` の定数） |

### 型

| 型                            | 説明                                                               |
| ----------------------------- | ------------------------------------------------------------------ |
| `FilterCondition<T>`          | 絞り込みの条件（列ごとの条件・配列・関数）                         |
| `FilterRecordCondition<T>`    | 列ごとの条件を並べたもの（`$and`・`$or`・`$not`・`$value` を含む） |
| `FilterColumnCondition<V, T>` | 列の値の条件                                                       |
| `FilterValueCondition<V, T>`  | 列の値の条件の1つ                                                  |
| `FilterColumnFunction<V, T>`  | 列の値を自由に判定する関数                                         |
| `FilterOperators`             | 演算子の集まり                                                     |
| `ComparisonOperator`          | 演算子の値の型（`@fringeworks/utils` の型）                        |
| `FilterSpec`                  | 絞り込みの条件のうち、JSON にできるもの                            |
| `FilterColumnSpec`            | 列の値の条件のうち、JSON にできるもの                              |
| `FilterValueSpec`             | 列の値の条件の1つのうち、JSON にできるもの                         |
| `FilterFunction<T>`           | 要素が条件に合うかを判定する関数（`createFilter` の戻り値）        |
| `CreateFilterOptions`         | `createFilter` のオプション                                        |
| `SortCondition<T>`            | 並べ替えの条件                                                     |
| `SortItem<T>`                 | 並べ替えのキー1つ                                                  |
| `SortKey<T>`                  | 並べ替えのキー（列のパスか、値を取り出す関数）                     |
| `SortSpec`                    | 並べ替えの条件のうち、JSON にできるもの                            |
| `SortItemSpec`                | 並べ替えのキー1つのうち、JSON にできるもの                         |
| `SortKeySpec`                 | 並べ替えのキーのうち、JSON にできるもの                            |
| `SortFunction<T>`             | 比較の関数（`createSort` の戻り値）                                |
| `SortDirection`               | 並べ替えの向き（`'asc'`・`'desc'`）                                |
| `SortNulls`                   | nullish の値の位置（`'first'`・`'last'`）                          |
| `CreateSortOptions`           | `createSort` のオプション                                          |

`FilterFunction<T>` と `SortFunction<T>` は、[`@fringeworks/types`](https://www.npmjs.com/package/@fringeworks/types) の同じ名前の型を、このパッケージから export したものです。`@fringeworks/state-model` の派生モデルの `filter`・`sort` も同じ型で受け取るので、作った関数をそのまま渡せます。

## ライセンス

MIT
