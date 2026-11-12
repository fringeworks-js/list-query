import type { SortFunction } from '@fringeworks/types';
import { isInvalidDate } from '@fringeworks/utils/type/isInvalidDate';
import _createGetter from '../_internal/_createGetter';
import type { CreateSortOptions, SortCondition, SortItem } from './types';

type Compare = (a: unknown, b: unknown) => number;

/**
 * 値の種類の順。種類が混ざったときは、この順に並べる
 */
const RANK = {
  number: 0,
  string: 1,
  boolean: 2,
  date: 3,
  other: 4,
} as const;

const keepOrder: Compare = () => 0;

/**
 * 並べ替えの条件から、比較の関数を作る
 *
 * 条件はデータ（JSON にできる形）でも関数でも書ける。条件は作るときに1回だけ解釈し、`Intl.Collator` もここで作る。
 *
 * - 省略: 要素そのものの昇順
 * - 文字列: 列のパスの昇順
 * - オブジェクト: `{ key, direction, nulls, ... }`。`key` を省くと要素そのもので並べる
 * - 関数: 比較の関数
 * - 配列: 優先する順に並べたもの。空の配列は並びを変えない
 *
 * 値は、数値・`bigint` は大小、文字列は `Intl.Collator`、真偽値は `false` が先、`Date` は時刻で比べる。
 * nullish の値（`null`・`undefined`・`NaN`・不正な `Date`）は、向きに関係なく `nulls` の位置に置く
 *
 * @param condition 並べ替えの条件
 * @param options 全体に効くオプション（キーごとのオブジェクトに書いたものが優先する）
 * @returns 比較の関数
 * @example
 * lines.sort(createSort([{ key: 'status' }, { key: 'price', direction: 'desc' }]));
 */
export default function createSort<T>(
  condition?: SortCondition<T>,
  options: CreateSortOptions = {},
): SortFunction<T> {
  const items = (
    condition === undefined
      ? [{}]
      : Array.isArray(condition)
        ? condition
        : [condition]
  ) as readonly (string | SortItem<T> | SortFunction<T>)[];
  const compares = items.map((item) => compileItem(item, options));
  if (compares.length === 0) {
    return keepOrder;
  }
  if (compares.length === 1) {
    return compares[0]!;
  }
  return (a, b) => {
    for (const compareItems of compares) {
      const result = compareItems(a, b);
      if (result !== 0) {
        return result;
      }
    }
    return 0;
  };
}

/**
 * 並べ替えのキー1つを比較の関数にする
 */
function compileItem<T>(
  item: string | SortItem<T> | SortFunction<T>,
  options: CreateSortOptions,
): Compare {
  if (typeof item === 'function') {
    return item as Compare;
  }
  const sortItem: SortItem<T> = typeof item === 'string' ? { key: item } : item;
  const getValue = toGetter(sortItem.key);
  const pick = <K extends keyof CreateSortOptions>(key: K) =>
    sortItem[key] !== undefined ? sortItem[key] : options[key];
  const nullsFirst = pick('nulls') === 'first';
  const sign = sortItem.direction === 'desc' ? -1 : 1;
  const collator = new Intl.Collator(
    pick('locale') as string | string[] | undefined,
    withoutUndefined({
      numeric: pick('numeric'),
      sensitivity: pick('sensitivity'),
      caseFirst: pick('caseFirst'),
      ignorePunctuation: pick('ignorePunctuation'),
    }),
  );

  return (a, b) => {
    const left = getValue(a);
    const right = getValue(b);
    const leftIsNull = isNullish(left);
    const rightIsNull = isNullish(right);
    if (leftIsNull || rightIsNull) {
      if (leftIsNull && rightIsNull) {
        return 0;
      }
      return leftIsNull === nullsFirst ? -1 : 1;
    }
    return sign * compareValues(left, right, collator);
  };
}

function toGetter<T>(key: SortItem<T>['key']): (item: unknown) => unknown {
  if (key === undefined) {
    return (item) => item;
  }
  if (typeof key === 'function') {
    return key as (item: unknown) => unknown;
  }
  return _createGetter(key);
}

/**
 * 並べ替えで nullish として扱う値か
 */
function isNullish(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    Number.isNaN(value) ||
    isInvalidDate(value)
  );
}

function rankOf(value: unknown): number {
  switch (typeof value) {
    case 'number':
    case 'bigint':
      return RANK.number;
    case 'string':
      return RANK.string;
    case 'boolean':
      return RANK.boolean;
    default:
      return value instanceof Date ? RANK.date : RANK.other;
  }
}

/**
 * nullish でない2つの値を比べる。種類が違えば種類の順、種類の順に入らないもの同士は同じ順位
 */
function compareValues(
  left: unknown,
  right: unknown,
  collator: Intl.Collator,
): number {
  const leftRank = rankOf(left);
  const rightRank = rankOf(right);
  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }
  switch (leftRank) {
    case RANK.number:
      return (left as number) < (right as number)
        ? -1
        : (left as number) > (right as number)
          ? 1
          : 0;
    case RANK.string:
      return collator.compare(left as string, right as string);
    case RANK.boolean:
      return Number(left) - Number(right);
    case RANK.date:
      return (left as Date).getTime() - (right as Date).getTime();
    default:
      return 0;
  }
}

/**
 * 値が undefined のプロパティを除く（`Intl.Collator` に、指定しなかったものとして渡すため）
 */
function withoutUndefined<O extends Record<string, unknown>>(
  values: O,
): Partial<O> {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined),
  ) as Partial<O>;
}
