# @fringeworks/list-query

`@fringeworks/list-query` is a library some will find handy, for building list filters and sort comparators from functions or JSON-friendly data.
It turns the conditions that screens and settings produce, such as per-column filters and multi-key sorting, into functions you can pass straight to `Array.prototype.filter` and `Array.prototype.sort`.

**[日本語のREADMEはこちら](./README.ja.md)**

## Features

- **Data or functions**: conditions can be written in a JSON-friendly form, so they can come straight from screen state or settings files. Anything data cannot express can be written as a function in the same place
- **Filters keyed by column**: write a condition per column, like `{ status: 'active', price: { '>=': 1000 } }`. An array means "any of" (OR), and operators in one object mean "all of" (AND)
- **Combinations**: `$and`, `$or`, and `$not` combine conditions from different places without overwriting them
- **Sorting**: multiple keys, ascending or descending, the position of nullish values, and string comparison with `Intl.Collator`
- **Value lists too**: `number[]` and `string[]` can be filtered and sorted as well
- **Runs anywhere**: uses only the ECMAScript standard. The results can also be passed as is to the `filter` and `sort` of `@fringeworks/state-model` derived models

## Installation

```sh
npm install @fringeworks/list-query
```

## Usage

```ts
import { createFilter, createSort } from '@fringeworks/list-query';

const visible = products
  .filter(
    createFilter({ status: ['active', 'pending'], price: { '>=': 1000 } }),
  )
  .sort(createSort([{ key: 'status' }, { key: 'price', direction: 'desc' }]));
```

### Filtering

Keys are column paths, and values are the conditions for those columns. Items that match every column are kept.

```ts
createFilter({
  status: ['active', 'pending'], // An array matches any of them (OR)
  name: { startsWith: 'Pen', endsWith: 'il' }, // Operators in one object must all match (AND)
  price: { '>=': 1000, '<=': 5000 },
  'address.city': 'Tokyo', // A path joined with . points to a nested value
});
```

A column condition can be one of the following.

| Condition                           | Meaning                                                                      |
| ----------------------------------- | ---------------------------------------------------------------------------- |
| String, number, boolean, `bigint`   | Equal (strings are affected by `ignoreCase` and `normalize`)                 |
| `null`                              | The value is `null` or `undefined` (the column is missing)                   |
| `Date`                              | The same time                                                                |
| `RegExp`                            | Matches the regular expression (the `g` flag does not change the result)     |
| Object of operators                 | Matches all the operators (AND). An object with no operators matches nothing |
| Array                               | Matches any of them (OR). An empty array matches nothing                     |
| Function `(value, item) => boolean` | Matches when it returns true                                                 |

Operators are the values of `ComparisonOperator` (the constant of `@fringeworks/utils`, exported from this package as well).

| Operator                                                | Meaning                                                                  |
| ------------------------------------------------------- | ------------------------------------------------------------------------ |
| `'==='`, `'!=='`, `'=='`, `'!='`                        | Equal, not equal                                                         |
| `'>'`, `'>='`, `'<'`, `'<='`                            | Greater or less (JavaScript comparison operators as is)                  |
| `between`, `notBetween`                                 | Range `[min, max]` (inclusive; `min` and `max` are swapped if reversed)  |
| `oneOf`, `notOneOf`                                     | Equal to one of the candidates, equal to none of them                    |
| `includes`, `notIncludes`, `includesAll`, `includesAny` | Substrings of a string, elements of an array                             |
| `startsWith`, `endsWith`                                | Prefix, suffix                                                           |
| `matches`                                               | Regular expression (can be a string; an invalid pattern matches nothing) |
| `deepEqual`, `notDeepEqual`                             | Structurally equal, not equal                                            |

- Unknown operator names are ignored
- When the column value is missing (`undefined`), the result follows JavaScript comparison (`undefined >= 1000` is false, `'!=='` is true)
- A column whose value is `undefined` is treated as not specified

### Combining conditions

```ts
// An array matches any of them (OR)
createFilter([{ status: 'archived' }, { price: { '<': 200 } }]);

// Combine conditions from different places (spreading would overwrite conditions on the same column)
createFilter({ $and: [systemFilter, userFilter] });

// Put an OR across different columns inside the AND
createFilter({
  status: 'active',
  $or: [{ price: { '>=': 1000 } }, { stock: 0 }],
});

// Negate a group of conditions
createFilter({ $not: { price: { '>=': 1000 }, stock: 0 } });

// Functions can be mixed in
createFilter({ $and: [{ status: 'active' }, (item) => item.lines.length > 0] });
```

| Condition                          | Meaning                                    |
| ---------------------------------- | ------------------------------------------ |
| `{}`, `{ $and: [] }`               | Matches everything (no filtering)          |
| `[]`, `{ $or: [] }`                | Matches nothing                            |
| `{}` or `[]` as a column condition | Matches nothing (no comparison is written) |

When all column filters are cleared, the condition becomes `{}` and the whole list stays.

### String comparison

```ts
createFilter({ name: { includes: 'pen' } }, { ignoreCase: true });
createFilter(
  { name: 'ペン' },
  { normalize: (value) => value.normalize('NFKC') },
);
```

`ignoreCase` and `normalize` apply when both sides are strings, to equality (string column conditions, `'==='`, `'!=='`, `oneOf`, `notOneOf`), substrings, prefixes, suffixes, and regular expressions. They do not apply to greater-or-less comparisons such as `'>'`.

### Sorting

```ts
createSort(); // Ascending by the items themselves
createSort('name'); // Ascending by a column
createSort({ key: 'price', direction: 'desc' });
createSort([{ key: 'status' }, { key: 'price', direction: 'desc' }]); // Keys in priority order
createSort({ key: (item) => item.lines.length }); // Sort by a computed value
createSort((a, b) => a.price - b.price); // A comparator
```

| Value                                      | Comparison                                                         |
| ------------------------------------------ | ------------------------------------------------------------------ |
| Number, `bigint`                           | Greater or less                                                    |
| String                                     | `Intl.Collator`                                                    |
| Boolean                                    | `false` first                                                      |
| `Date`                                     | Time                                                               |
| `null`, `undefined`, `NaN`, invalid `Date` | At the position of `nulls` regardless of direction (default: last) |

- When the previous key ties, the next key is compared. When all keys tie, the original order is kept (`Array.prototype.sort` is stable)
- When values of different kinds are mixed, they are ordered as numbers, strings, booleans, `Date`, then others
- String comparison can be set with `locale`, `numeric`, `sensitivity`, `caseFirst`, and `ignorePunctuation` (the same names as `Intl.Collator`). In the second argument they apply to all keys, and in a key's object they apply to that key only

```ts
createSort('name', { locale: 'ja', numeric: true });
createSort([{ key: 'code', numeric: true }, { key: 'name' }], { locale: 'ja' });
```

### Nested values and special column names

Column paths are read by the rules of `parsePropertyPath` in `@fringeworks/utils`.

```ts
createFilter({ 'address.city': 'Tokyo' }); // A nested value
createFilter({ 'lines[0].price': { '>': 0 } }); // An array index
createFilter({ '["a.b"]': 1, '["$price"]': { '>': 10 } }); // Quote keys that contain . or $
createSort({ key: ['address', 'city'] }); // Sorting also accepts an array of keys
```

Keys starting with `$` are special keys (`$and`, `$or`, `$not`, `$value`). Write a column that starts with `$` in quotes.

### Value lists

```ts
[5, 10, 20].filter(createFilter<number>({ $value: { '>=': 10 } })); // [10, 20]
names.sort(createSort({ locale: 'ja' }));
```

### Keeping conditions as data

Conditions can be written in JSON-friendly forms (`FilterSpec` and `SortSpec`), so conditions from a URL, saved settings, or a server can be passed as is.

```ts
const filter: FilterSpec = JSON.parse(saved.filter);
const sort: SortSpec = JSON.parse(saved.sort);
const visible = createDerivedList(lines, {
  filter: createFilter(filter),
  sort: createSort(sort),
});
```

### Types

Passing the item type to `createFilter<T>` and `createSort<T>` completes column names and types the arguments of per-column functions. Because they also accept conditions read from JSON (`FilterSpec` and `SortSpec`), misspelled column names are not caught by the types.

## API

| Function                            | Description                                                         |
| ----------------------------------- | ------------------------------------------------------------------- |
| `createFilter(condition, options?)` | Creates a function that tells whether an item matches the condition |
| `createSort(condition?, options?)`  | Creates a comparator from the sort condition                        |

### `createFilter`

```ts
createFilter<T>(
  condition: FilterCondition<T> | FilterSpec,
  options?: CreateFilterOptions,
): FilterFunction<T>
```

Creates a function that tells whether an item matches the filter condition. The condition is read once, when the function is created.

| Parameter   | Type                               | Description          |
| ----------- | ---------------------------------- | -------------------- |
| `condition` | `FilterCondition<T> \| FilterSpec` | The filter condition |
| `options?`  | `CreateFilterOptions`              | The options below    |

| Option        | Type                        | Description                                     |
| ------------- | --------------------------- | ----------------------------------------------- |
| `ignoreCase?` | `boolean`                   | Ignores upper and lower case (default: `false`) |
| `normalize?`  | `(value: string) => string` | Normalizes strings before comparing             |

### `createSort`

```ts
createSort<T>(
  condition?: SortCondition<T>,
  options?: CreateSortOptions,
): SortFunction<T>
```

Creates a comparator from the sort condition. Without a condition, it sorts the items themselves in ascending order. The condition and `Intl.Collator` are prepared once, when the comparator is created.

| Parameter    | Type                | Description                                       |
| ------------ | ------------------- | ------------------------------------------------- |
| `condition?` | `SortCondition<T>`  | The sort condition                                |
| `options?`   | `CreateSortOptions` | The options below. Per-key settings take priority |

| Option               | Type                                  | Description                                                   |
| -------------------- | ------------------------------------- | ------------------------------------------------------------- |
| `nulls?`             | `'first' \| 'last'`                   | Where to put nullish values (default: `'last'`)               |
| `locale?`            | `string \| readonly string[]`         | Locale for comparing strings (default: the runtime's default) |
| `numeric?`           | `boolean`                             | Compares digit sequences as numbers (default: `false`)        |
| `sensitivity?`       | `Intl.CollatorOptions['sensitivity']` | Which differences in strings to distinguish                   |
| `caseFirst?`         | `Intl.CollatorOptions['caseFirst']`   | Whether upper or lower case comes first                       |
| `ignorePunctuation?` | `boolean`                             | Ignores punctuation (default: `false`)                        |

A sort key object (`SortItem<T>`) has the options above and the following properties.

| Property     | Type              | Description                                                                                                               |
| ------------ | ----------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `key?`       | `SortKey<T>`      | A column path (a string or an array of keys) or a function that takes out the value. Omit it to sort the items themselves |
| `direction?` | `'asc' \| 'desc'` | Direction (default: `'asc'`)                                                                                              |

### Constants

| Constant             | Description                                              |
| -------------------- | -------------------------------------------------------- |
| `ComparisonOperator` | The operator values (a constant of `@fringeworks/utils`) |

### Types

| Type                          | Description                                                                       |
| ----------------------------- | --------------------------------------------------------------------------------- |
| `FilterCondition<T>`          | A filter condition (per-column conditions, an array, or a function)               |
| `FilterRecordCondition<T>`    | Per-column conditions (including `$and`, `$or`, `$not`, `$value`)                 |
| `FilterColumnCondition<V, T>` | A condition on a column value                                                     |
| `FilterValueCondition<V, T>`  | One condition on a column value                                                   |
| `FilterColumnFunction<V, T>`  | A function that freely tests a column value                                       |
| `FilterOperators`             | An object of operators                                                            |
| `ComparisonOperator`          | The type of the operator values (a type of `@fringeworks/utils`)                  |
| `FilterSpec`                  | The JSON-friendly part of a filter condition                                      |
| `FilterColumnSpec`            | The JSON-friendly part of a column condition                                      |
| `FilterValueSpec`             | The JSON-friendly part of one column condition                                    |
| `FilterFunction<T>`           | A function that tells whether an item matches (the return type of `createFilter`) |
| `CreateFilterOptions`         | The options of `createFilter`                                                     |
| `SortCondition<T>`            | A sort condition                                                                  |
| `SortItem<T>`                 | One sort key                                                                      |
| `SortKey<T>`                  | A sort key (a column path or a function that takes out the value)                 |
| `SortSpec`                    | The JSON-friendly part of a sort condition                                        |
| `SortItemSpec`                | The JSON-friendly part of one sort key                                            |
| `SortKeySpec`                 | The JSON-friendly part of a sort key                                              |
| `SortFunction<T>`             | A comparator (the return type of `createSort`)                                    |
| `SortDirection`               | Sort direction (`'asc'`, `'desc'`)                                                |
| `SortNulls`                   | Position of nullish values (`'first'`, `'last'`)                                  |
| `CreateSortOptions`           | The options of `createSort`                                                       |

`FilterFunction<T>` and `SortFunction<T>` are the types of the same names from [`@fringeworks/types`](https://www.npmjs.com/package/@fringeworks/types), exported from this package as well. The derived models of `@fringeworks/state-model` take `filter` and `sort` as the same types, so the functions you create can be passed as they are.

## License

MIT
