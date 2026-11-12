import createSort from './createSort';
import type { SortSpec } from './types';

type Item = {
  id: string;
  name: string;
  price: number | null;
  status: string;
  createdAt?: Date;
  address?: { city: string };
};

const items: Item[] = [
  {
    id: 'I-1',
    name: 'item10',
    price: 300,
    status: 'b',
    createdAt: new Date('2026-03-01'),
  },
  {
    id: 'I-2',
    name: 'item2',
    price: null,
    status: 'a',
    address: { city: 'Osaka' },
  },
  {
    id: 'I-3',
    name: 'Item1',
    price: 100,
    status: 'b',
    createdAt: new Date('2026-01-01'),
    address: { city: 'Tokyo' },
  },
  { id: 'I-4', name: 'item3', price: 300, status: 'a' },
];

const sortIds = (sort: (a: Item, b: Item) => number) =>
  [...items].sort(sort).map((item) => item.id);

describe('createSort', () => {
  it('引数を省くと要素そのものの昇順', () => {
    expect([3, 1, 2].sort(createSort())).toEqual([1, 2, 3]);
    expect(['b', 'c', 'a'].sort(createSort())).toEqual(['a', 'b', 'c']);
  });

  it('key を省くと要素そのもので並べる', () => {
    expect([3, 1, 2].sort(createSort({ direction: 'desc' }))).toEqual([
      3, 2, 1,
    ]);
  });

  it('文字列は key の省略形（昇順）', () => {
    expect(sortIds(createSort<Item>('status'))).toEqual([
      'I-2',
      'I-4',
      'I-1',
      'I-3',
    ]);
  });

  it('配列は優先する順に並べたキー。並べ替えは安定', () => {
    expect(
      sortIds(
        createSort<Item>([
          { key: 'status' },
          { key: 'price', direction: 'desc' },
        ]),
      ),
    ).toEqual(['I-4', 'I-2', 'I-1', 'I-3']);
  });

  it('空の配列は並びを変えない', () => {
    expect(sortIds(createSort<Item>([]))).toEqual(['I-1', 'I-2', 'I-3', 'I-4']);
  });

  it('nullish の値は、向きに関係なく既定で末尾に置く', () => {
    expect(sortIds(createSort<Item>({ key: 'price' }))).toEqual([
      'I-3',
      'I-1',
      'I-4',
      'I-2',
    ]);
    expect(
      sortIds(createSort<Item>({ key: 'price', direction: 'desc' })),
    ).toEqual(['I-1', 'I-4', 'I-3', 'I-2']);
  });

  it('nulls: first で先頭に置く。2つ目の引数に書くと全体に効き、キーごとの指定が優先する', () => {
    expect(sortIds(createSort<Item>({ key: 'price', nulls: 'first' }))).toEqual(
      ['I-2', 'I-3', 'I-1', 'I-4'],
    );
    expect(sortIds(createSort<Item>('price', { nulls: 'first' }))).toEqual([
      'I-2',
      'I-3',
      'I-1',
      'I-4',
    ]);
    expect(
      sortIds(
        createSort<Item>({ key: 'price', nulls: 'last' }, { nulls: 'first' }),
      ),
    ).toEqual(['I-3', 'I-1', 'I-4', 'I-2']);
  });

  it('NaN と不正な Date も nullish として扱う', () => {
    expect([2, NaN, 1].sort(createSort())).toEqual([1, 2, NaN]);
    const invalid = new Date('x');
    const dates = [new Date(2), invalid, new Date(1)].sort(createSort());
    expect(dates[2]).toBe(invalid);
  });

  it('Date は時刻で比べる', () => {
    expect(sortIds(createSort<Item>('createdAt'))).toEqual([
      'I-3',
      'I-1',
      'I-2',
      'I-4',
    ]);
  });

  it('真偽値は false が先', () => {
    expect([true, false, true].sort(createSort())).toEqual([false, true, true]);
  });

  it('文字列は Intl.Collator で比べる。numeric などを指定できる', () => {
    expect(sortIds(createSort<Item>({ key: 'name', numeric: true }))).toEqual([
      'I-3',
      'I-2',
      'I-4',
      'I-1',
    ]);
    expect(
      ['b', 'a', 'B'].sort(createSort({ caseFirst: 'upper', locale: 'en' })),
    ).toEqual(['a', 'B', 'b']);
  });

  it('ネストした値は、. でつないだパスかパスの配列で指す', () => {
    expect(sortIds(createSort<Item>('address.city'))).toEqual([
      'I-2',
      'I-3',
      'I-1',
      'I-4',
    ]);
    expect(
      sortIds(
        createSort<Item>({ key: ['address', 'city'], direction: 'desc' }),
      ),
    ).toEqual(['I-3', 'I-2', 'I-1', 'I-4']);
  });

  it('key に、値を取り出す関数を渡せる', () => {
    expect(
      sortIds(
        createSort<Item>({
          key: (item) => item.name.length,
          direction: 'desc',
        }),
      ),
    ).toEqual(['I-1', 'I-2', 'I-3', 'I-4']);
  });

  it('比較の関数を、配列の中にも書ける', () => {
    expect(
      sortIds(
        createSort<Item>(['status', (a, b) => a.id.localeCompare(b.id) * -1]),
      ),
    ).toEqual(['I-4', 'I-2', 'I-3', 'I-1']);
  });

  it('種類が混ざったときは、数値・文字列・真偽値・Date の順', () => {
    const date = new Date(0);
    expect([date, true, 'a', 1].sort(createSort())).toEqual([
      1,
      'a',
      true,
      date,
    ]);
  });

  it('JSON から読んだ条件をそのまま渡せる', () => {
    const spec = JSON.parse(
      '[{ "key": "status" }, { "key": "price", "direction": "desc" }]',
    ) as SortSpec;
    expect(sortIds(createSort<Item>(spec))).toEqual([
      'I-4',
      'I-2',
      'I-1',
      'I-3',
    ]);
  });
});
