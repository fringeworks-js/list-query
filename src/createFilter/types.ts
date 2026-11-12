import type { FilterFunction } from '@fringeworks/types';
import type {
  CompareRight,
  ComparisonOperator,
} from '@fringeworks/utils/compare/compare';
import type { CreateStringMatcherOptions } from '@fringeworks/utils/string/createStringMatcher';

// 要素が条件に合うかを判定する関数（`createFilter` の戻り値）。
// 利用者が `@fringeworks/types` を入れずに使えるよう、ここから export する
export type { FilterFunction } from '@fringeworks/types';

/**
 * 列の値に当てる演算子の集まり（`{ '>=': 1000, '<=': 5000 }`）\
 * キーは `@fringeworks/utils` の `ComparisonOperator` の値。すべてに合うときに一致する（AND）。
 * 知らない名前は無視し、演算子を1つも書いていない場合は何にも一致しない
 */
export type FilterOperators = {
  readonly [O in ComparisonOperator]?: CompareRight[O];
};

/**
 * 列の値の条件の1つのうち、JSON にできるもの
 *
 * - 文字列・数値・真偽値: 等しい（文字列は `ignoreCase`・`normalize` が効く）
 * - `null`: 値が `null` か `undefined`（列が無い）
 * - `FilterOperators`: 演算子の集まり
 */
export type FilterValueSpec =
  string | number | boolean | null | FilterOperators;

/**
 * 列の値の条件のうち、JSON にできるもの。配列は、どれかに合うときに一致する（OR）
 */
export type FilterColumnSpec = FilterValueSpec | readonly FilterValueSpec[];

/**
 * 絞り込みの条件のうち、JSON にできるもの
 *
 * - オブジェクト: キーは列のパス、値はその列の条件。すべての列に合うときに一致する（AND）。
 *   `$and`・`$or`・`$not`・`$value` は特別なキー（`FilterRecordCondition` を参照）。条件を1つも書いていない `{}` はすべてに一致する
 * - 配列: どれかに合うときに一致する（OR）。空の配列は何にも一致しない
 */
export type FilterSpec =
  | { readonly [key: string]: FilterColumnSpec | FilterSpec | undefined }
  | readonly FilterSpec[];

/**
 * 列の値を自由に判定する関数
 */
export type FilterColumnFunction<V, T> = (value: V, item: T) => boolean;

/**
 * 列の値の条件の1つ\
 * `FilterValueSpec` に加えて、`bigint`（等しい）・`Date`（時刻が等しい）・`RegExp`（正規表現に一致する）・関数を受け付ける
 */
export type FilterValueCondition<V, T> =
  FilterValueSpec | bigint | Date | RegExp | FilterColumnFunction<V, T>;

/**
 * 列の値の条件。配列は、どれかに合うときに一致する（OR）。空の配列は何にも一致しない
 */
export type FilterColumnCondition<V, T> =
  FilterValueCondition<V, T> | readonly FilterValueCondition<V, T>[];

/**
 * 列ごとの条件を並べた絞り込みの条件。すべてに合うときに一致する（AND）
 *
 * キーは列のパス（`'address.city'` のように `.` でつなぐと、ネストした値を指す）。`$` で始まるキーは特別なキーで、
 * `$` で始まる列は `'["$price"]'` のように引用符で囲んで書く
 */
export type FilterRecordCondition<T> = {
  readonly [K in keyof T & string]?: FilterColumnCondition<T[K], T>;
} & {
  readonly [path: `${string}.${string}` | `${string}[${string}`]:
    FilterColumnCondition<unknown, T> | undefined;
} & {
  /** すべてに合うときに一致する。空の配列はすべてに一致する */
  readonly $and?: readonly FilterCondition<T>[];
  /** どれかに合うときに一致する。空の配列は何にも一致しない */
  readonly $or?: readonly FilterCondition<T>[];
  /** 合わないときに一致する */
  readonly $not?: FilterCondition<T>;
  /** 要素そのものの条件（`number[]`・`string[]` などの値の一覧に使う） */
  readonly $value?: FilterColumnCondition<T, T>;
};

/**
 * 絞り込みの条件
 *
 * - オブジェクト: 列ごとの条件（`FilterRecordCondition`）
 * - 配列: どれかに合うときに一致する（OR）。空の配列は何にも一致しない
 * - 関数: 真を返したときに一致する
 */
export type FilterCondition<T> =
  FilterRecordCondition<T> | readonly FilterCondition<T>[] | FilterFunction<T>;

/**
 * `createFilter` のオプション（`@fringeworks/utils` の `createStringMatcher` と同じ）\
 * 両方が文字列のときの、等しいか（`'==='`・`'!=='`・`oneOf`・`notOneOf`、列の条件の文字列）・`includes` などの部分一致・
 * `startsWith`・`endsWith`・`matches`（正規表現）に効く。大小の比較（`'>'` など）には効かない
 */
export type CreateFilterOptions = CreateStringMatcherOptions;
