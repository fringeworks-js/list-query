import type { SortFunction } from '@fringeworks/types';

// 比較の関数（`createSort` の戻り値）。
// 利用者が `@fringeworks/types` を入れずに使えるよう、ここから export する
export type { SortFunction } from '@fringeworks/types';

/**
 * 並べ替えの向き（`'asc'` は昇順、`'desc'` は降順）
 */
export type SortDirection = 'asc' | 'desc';

/**
 * nullish の値（`null`・`undefined`・`NaN`・不正な `Date`）を置く位置。向きに関係なく、先頭か末尾に置く
 */
export type SortNulls = 'first' | 'last';

/**
 * `createSort` のオプション（全体に効く）。並べ替えのキーごとのオブジェクトにも書け、そのキーではそちらが優先する
 */
export type CreateSortOptions = {
  /**
   * nullish の値を置く位置
   * @default 'last'
   */
  nulls?: SortNulls;

  /**
   * 文字列を比べるロケール（`Intl.Collator` の `locales`）。省略すると実行環境の既定
   */
  locale?: string | readonly string[];

  /**
   * 数字の並びを数として比べる（`Intl.Collator` の `numeric`。`'item2'` が `'item10'` より先になる）
   * @default false
   */
  numeric?: boolean;

  /**
   * 文字列のどの違いを区別するか（`Intl.Collator` の `sensitivity`）
   */
  sensitivity?: Intl.CollatorOptions['sensitivity'];

  /**
   * 大文字と小文字のどちらを先にするか（`Intl.Collator` の `caseFirst`）
   */
  caseFirst?: Intl.CollatorOptions['caseFirst'];

  /**
   * 句読点を無視する（`Intl.Collator` の `ignorePunctuation`）
   * @default false
   */
  ignorePunctuation?: boolean;
};

/**
 * 並べ替えのキーのうち、JSON にできるもの（列のパス。文字列か、キーの配列）
 */
export type SortKeySpec = string | readonly (string | number)[];

/**
 * 並べ替えのキー1つのうち、JSON にできるもの
 */
export type SortItemSpec = CreateSortOptions & {
  /**
   * 列のパス。省略すると要素そのもので並べる
   */
  key?: SortKeySpec;

  /**
   * 向き
   * @default 'asc'
   */
  direction?: SortDirection;
};

/**
 * 並べ替えの条件のうち、JSON にできるもの
 *
 * - 文字列: 列のパス（昇順）
 * - オブジェクト: 並べ替えのキー1つ
 * - 配列: 優先する順に並べたキー（前のキーで同じ順位なら、次のキーで比べる）
 */
export type SortSpec =
  string | SortItemSpec | readonly (string | SortItemSpec)[];

/**
 * 並べ替えのキー（列のパスか、要素から値を取り出す関数）
 */
export type SortKey<T> =
  | (keyof T & string)
  | (string & {})
  | readonly (string | number)[]
  | ((item: T) => unknown);

/**
 * 並べ替えのキー1つ
 */
export type SortItem<T> = CreateSortOptions & {
  /**
   * 列のパスか、要素から値を取り出す関数。省略すると要素そのもので並べる
   */
  key?: SortKey<T>;

  /**
   * 向き
   * @default 'asc'
   */
  direction?: SortDirection;
};

/**
 * 並べ替えの条件
 *
 * - 文字列: 列のパス（昇順）
 * - オブジェクト: 並べ替えのキー1つ（`{ key, direction, nulls, ... }`）
 * - 関数: 比較の関数
 * - 配列: 優先する順に並べたもの（前のもので同じ順位なら、次のもので比べる）
 */
export type SortCondition<T> =
  | (keyof T & string)
  | (string & {})
  | SortItem<T>
  | SortFunction<T>
  | readonly (
      (keyof T & string) | (string & {}) | SortItem<T> | SortFunction<T>
    )[];
