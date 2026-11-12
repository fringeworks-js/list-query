import type { FilterFunction } from '@fringeworks/types';
import {
  compare,
  ComparisonOperator,
} from '@fringeworks/utils/compare/compare';
import type { StringCondition } from '@fringeworks/utils/string/createStringMatcher';
import { createStringMatcher } from '@fringeworks/utils/string/createStringMatcher';
import { isRegExp } from '@fringeworks/utils/type/isRegExp';
import _createGetter from '../_internal/_createGetter';
import _isPlainObject from '../_internal/_isPlainObject';
import type { CreateFilterOptions, FilterCondition, FilterSpec } from './types';

type Predicate = (item: unknown) => boolean;
type ColumnPredicate = (value: unknown, item: unknown) => boolean;
type ValueTest = (value: unknown) => boolean;
type Matcher = (condition: StringCondition) => (value: string) => boolean;

const OPERATORS: ReadonlySet<string> = new Set(
  Object.values(ComparisonOperator),
);

const always = () => true;
const never = () => false;

/**
 * 絞り込みの条件から、要素が条件に合うかを判定する関数を作る
 *
 * 条件はデータ（JSON にできる形）でも関数でも書ける。条件は作るときに1回だけ解釈する。
 *
 * - オブジェクト: キーは列のパス、値はその列の条件。すべての列に合うときに一致する。`{}` はすべてに一致する
 * - 配列: どれかに合うときに一致する。空の配列は何にも一致しない
 * - `$and`・`$or`・`$not`: 条件の組み合わせ。`$value`: 要素そのものの条件
 * - 列の条件: 文字列・数値・真偽値・`bigint` は等しい、`null` は `null` か `undefined`、`Date` は時刻が等しい、
 *   `RegExp` は正規表現に一致する、オブジェクトは演算子の集まり（AND）、配列はどれか（OR）、関数は自由に判定する
 *
 * @param condition 絞り込みの条件
 * @param options 文字列の比べ方
 * @returns 要素が条件に合うかを判定する関数
 * @example
 * lines.filter(createFilter({ status: ['active', 'pending'], price: { '>=': 1000 } }));
 */
export default function createFilter<T>(
  condition: FilterCondition<T> | FilterSpec,
  options: CreateFilterOptions = {},
): FilterFunction<T> {
  const matcher: Matcher = (stringCondition) =>
    createStringMatcher(stringCondition, options);
  return compileCondition(condition, matcher);
}

/**
 * 要素に対する条件を判定する関数にする
 */
function compileCondition(condition: unknown, matcher: Matcher): Predicate {
  if (typeof condition === 'function') {
    return condition as Predicate;
  }
  if (Array.isArray(condition)) {
    const predicates = condition.map((item) => compileCondition(item, matcher));
    return (item) => predicates.some((predicate) => predicate(item));
  }
  if (typeof condition !== 'object' || condition === null) {
    return never;
  }

  const predicates: Predicate[] = [];
  for (const [key, value] of Object.entries(condition)) {
    if (value === undefined) {
      continue;
    }
    switch (key) {
      case '$and': {
        const all = toArray(value).map((item) =>
          compileCondition(item, matcher),
        );
        predicates.push((item) => all.every((predicate) => predicate(item)));
        break;
      }
      case '$or':
        predicates.push(compileCondition(toArray(value), matcher));
        break;
      case '$not': {
        const negated = compileCondition(value, matcher);
        predicates.push((item) => !negated(item));
        break;
      }
      case '$value': {
        const column = compileColumn(value, matcher);
        predicates.push((item) => column(item, item));
        break;
      }
      default: {
        // 知らない特別なキーは無視する（`$` で始まる列は、引用符で囲んで書く）
        if (key.startsWith('$')) {
          break;
        }
        const getValue = _createGetter(key);
        const column = compileColumn(value, matcher);
        predicates.push((item) => column(getValue(item), item));
      }
    }
  }
  if (predicates.length === 0) {
    return always;
  }
  return (item) => predicates.every((predicate) => predicate(item));
}

/**
 * 列の値に対する条件を判定する関数にする
 */
function compileColumn(condition: unknown, matcher: Matcher): ColumnPredicate {
  if (typeof condition === 'function') {
    return condition as ColumnPredicate;
  }
  if (Array.isArray(condition)) {
    const predicates = condition
      .filter((item) => item !== undefined)
      .map((item) => compileColumn(item, matcher));
    return (value, item) =>
      predicates.some((predicate) => predicate(value, item));
  }
  if (condition === null) {
    return (value) => value === null || value === undefined;
  }
  if (typeof condition === 'string' || isRegExp(condition)) {
    const match = matcher(condition);
    return (value) => typeof value === 'string' && match(value);
  }
  if (condition instanceof Date) {
    const time = condition.getTime();
    return (value) => value instanceof Date && Object.is(value.getTime(), time);
  }
  if (_isPlainObject(condition)) {
    const tests: ValueTest[] = [];
    for (const [operator, right] of Object.entries(condition)) {
      if (right !== undefined && OPERATORS.has(operator)) {
        tests.push(
          createOperatorTest(operator as ComparisonOperator, right, matcher),
        );
      }
    }
    if (tests.length === 0) {
      return never;
    }
    return (value) => tests.every((test) => test(value));
  }
  return (value) => value === condition;
}

/**
 * 演算子1つの判定を作る
 *
 * 両方が文字列のときの、等しいか・部分一致・前方一致・後方一致・正規表現は、`createStringMatcher` で比べる
 * （`ignoreCase`・`normalize` を効かせ、正規表現の `g` フラグで結果が変わらないようにするため）。それ以外は `compare` に任せる
 */
function createOperatorTest(
  operator: ComparisonOperator,
  right: unknown,
  matcher: Matcher,
): ValueTest {
  const byCompare: ValueTest = (value) =>
    compare(value as never, operator, right as never);
  switch (operator) {
    case '===':
    case '!==': {
      if (typeof right !== 'string') {
        return byCompare;
      }
      const match = matcher(right);
      const equals: ValueTest = (value) =>
        typeof value === 'string' && match(value);
      return operator === '===' ? equals : (value) => !equals(value);
    }
    case 'oneOf':
    case 'notOneOf': {
      if (!Array.isArray(right)) {
        return byCompare;
      }
      const strings = right.filter((item) => typeof item === 'string');
      const others = right.filter((item) => typeof item !== 'string');
      const match = strings.length > 0 ? matcher(strings) : never;
      const isOneOf: ValueTest = (value) =>
        typeof value === 'string'
          ? match(value)
          : compare(value, 'oneOf', others);
      return operator === 'oneOf' ? isOneOf : (value) => !isOneOf(value);
    }
    case 'includes':
    case 'notIncludes': {
      if (typeof right !== 'string') {
        return byCompare;
      }
      const match = matcher({ includes: right });
      return (value) =>
        typeof value === 'string'
          ? operator === 'includes'
            ? match(value)
            : !match(value)
          : byCompare(value);
    }
    case 'includesAll':
    case 'includesAny': {
      if (!Array.isArray(right)) {
        return byCompare;
      }
      const matches = right.map((part) =>
        typeof part === 'string' ? matcher({ includes: part }) : never,
      );
      return (value) => {
        if (typeof value !== 'string') {
          return byCompare(value);
        }
        return operator === 'includesAll'
          ? matches.every((match) => match(value))
          : matches.some((match) => match(value));
      };
    }
    case 'startsWith':
    case 'endsWith': {
      if (typeof right !== 'string') {
        return never;
      }
      const match = matcher({ [operator]: right });
      return (value) => typeof value === 'string' && match(value);
    }
    case 'matches': {
      if (typeof right !== 'string' && !isRegExp(right)) {
        return never;
      }
      const match = matcher(isRegExp(right) ? right : { matches: right });
      return (value) => typeof value === 'string' && match(value);
    }
    default:
      return byCompare;
  }
}

function toArray(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [value];
}
