import createFilter from './createFilter';
import type { FilterSpec } from './types';

type Product = {
  id: string;
  name: string;
  status: string | null;
  price: number;
  tags: string[];
  releasedAt?: Date;
  address?: { city: string };
};

const products: Product[] = [
  {
    id: 'P-1',
    name: 'Pen',
    status: 'active',
    price: 300,
    tags: ['office'],
    address: { city: 'Tokyo' },
  },
  {
    id: 'P-2',
    name: 'Notebook',
    status: 'active',
    price: 1200,
    tags: ['office', 'paper'],
    releasedAt: new Date('2026-01-01'),
    address: { city: 'Osaka' },
  },
  {
    id: 'P-3',
    name: 'Bag',
    status: 'archived',
    price: 5000,
    tags: [],
    releasedAt: new Date('2026-06-01'),
  },
  { id: 'P-4', name: 'pencil', status: null, price: 150, tags: ['office'] },
];

const ids = (items: readonly Product[]) => items.map((item) => item.id);
const run = (condition: Parameters<typeof createFilter<Product>>[0]) =>
  ids(products.filter(createFilter<Product>(condition)));

describe('createFilter', () => {
  describe('列ごとの条件', () => {
    it('すべての列に合うものを残す（AND）', () => {
      expect(run({ status: 'active', price: { '>=': 1000 } })).toEqual(['P-2']);
    });

    it('条件を1つも書いていない {} はすべてに一致する', () => {
      expect(run({})).toEqual(['P-1', 'P-2', 'P-3', 'P-4']);
    });

    it('値が undefined の列は、指定しなかったものとして扱う', () => {
      expect(run({ status: undefined, price: { '<': 500 } })).toEqual([
        'P-1',
        'P-4',
      ]);
    });

    it('文字列・数値は等しい', () => {
      expect(run({ name: 'Pen' })).toEqual(['P-1']);
      expect(run({ price: 300 })).toEqual(['P-1']);
    });

    it('null は null か undefined（列が無い）に一致する', () => {
      expect(run({ status: null })).toEqual(['P-4']);
      expect(run({ releasedAt: null })).toEqual(['P-1', 'P-4']);
    });

    it('Date は時刻が等しい', () => {
      expect(run({ releasedAt: new Date('2026-01-01') })).toEqual(['P-2']);
    });

    it('RegExp は正規表現に一致する。g フラグでも結果が変わらない', () => {
      const filter = createFilter<Product>({ name: /^pen/gi });
      expect(ids(products.filter(filter))).toEqual(['P-1', 'P-4']);
      expect(ids(products.filter(filter))).toEqual(['P-1', 'P-4']);
    });

    it('配列は、どれかに合うもの（OR）。空の配列は何にも一致しない', () => {
      expect(run({ status: ['active', null] })).toEqual(['P-1', 'P-2', 'P-4']);
      expect(run({ status: [] })).toEqual([]);
    });

    it('関数は、列の値と要素を受け取る', () => {
      expect(
        run({ tags: (tags, item) => tags.length >= 2 || item.price > 3000 }),
      ).toEqual(['P-2', 'P-3']);
    });
  });

  describe('演算子', () => {
    it('1つのオブジェクトに並べた演算子は、すべてに合うもの（AND）', () => {
      expect(run({ price: { '>=': 200, '<=': 1500 } })).toEqual(['P-1', 'P-2']);
    });

    it('between は範囲（両端を含む）', () => {
      expect(run({ price: { between: [300, 1200] } })).toEqual(['P-1', 'P-2']);
    });

    it('oneOf・notOneOf', () => {
      expect(run({ status: { oneOf: ['archived', null] } })).toEqual([
        'P-3',
        'P-4',
      ]);
      expect(run({ status: { notOneOf: ['active'] } })).toEqual(['P-3', 'P-4']);
    });

    it('includes は文字列の部分一致と、配列の要素', () => {
      expect(run({ name: { includes: 'en' } })).toEqual(['P-1', 'P-4']);
      expect(run({ tags: { includes: 'paper' } })).toEqual(['P-2']);
      expect(run({ tags: { includesAll: ['office', 'paper'] } })).toEqual([
        'P-2',
      ]);
    });

    it('startsWith・endsWith・matches', () => {
      expect(run({ name: { startsWith: 'P' } })).toEqual(['P-1']);
      expect(run({ name: { endsWith: 'il' } })).toEqual(['P-4']);
      expect(run({ name: { matches: '^[A-Z]' } })).toEqual([
        'P-1',
        'P-2',
        'P-3',
      ]);
    });

    it('正規表現として不正な文字列は、何にも一致しない', () => {
      expect(run({ name: { matches: '(' } })).toEqual([]);
    });

    it('知らない演算子は無視し、演算子が1つも無ければ何にも一致しない', () => {
      expect(run({ price: { '>=': 1000, startWith: 'x' } as never })).toEqual([
        'P-2',
        'P-3',
      ]);
      expect(run({ price: {} })).toEqual([]);
    });

    it('列の値が無いときは、JavaScript の比較に任せる', () => {
      expect(run({ releasedAt: { '>=': new Date('2026-03-01') } })).toEqual([
        'P-3',
      ]);
    });
  });

  describe('文字列の比べ方（ignoreCase・normalize）', () => {
    it('等しいか・部分一致などに効く', () => {
      const filter = (condition: Parameters<typeof createFilter<Product>>[0]) =>
        ids(
          products.filter(
            createFilter<Product>(condition, { ignoreCase: true }),
          ),
        );
      expect(filter({ name: 'pen' })).toEqual(['P-1']);
      expect(filter({ name: { startsWith: 'p' } })).toEqual(['P-1', 'P-4']);
      expect(filter({ status: { oneOf: ['ACTIVE'] } })).toEqual(['P-1', 'P-2']);
      expect(filter({ name: { '!==': 'PEN' } })).toEqual(['P-2', 'P-3', 'P-4']);
    });

    it('normalize は両方の文字列に使う', () => {
      const filter = createFilter<{ name: string }>(
        { name: 'ﾍﾟﾝ' },
        { normalize: (value) => value.normalize('NFKC') },
      );
      expect(filter({ name: 'ペン' })).toBe(true);
    });
  });

  describe('ネストした値の列', () => {
    it('. でつないだパスで指す', () => {
      expect(run({ 'address.city': 'Tokyo' })).toEqual(['P-1']);
    });

    it('引用符で囲むと、. や $ を含むキーを指せる', () => {
      const filter = createFilter<Record<string, number>>({
        '["a.b"]': 1,
        '["$price"]': { '>': 10 },
      });
      expect(filter({ 'a.b': 1, $price: 20 })).toBe(true);
      expect(filter({ 'a.b': 1, $price: 5 })).toBe(false);
    });
  });

  describe('組み合わせ', () => {
    it('配列は、どれかに合うもの（OR）。空の配列は何にも一致しない', () => {
      expect(run([{ status: 'archived' }, { price: { '<': 200 } }])).toEqual([
        'P-3',
        'P-4',
      ]);
      expect(run([])).toEqual([]);
    });

    it('$and は別々のところから来た条件を、上書きせずにまとめる', () => {
      const system = { status: 'active' };
      const user = { price: { '>=': 1000 } };
      expect(run({ $and: [system, user] })).toEqual(['P-2']);
      expect(run({ $and: [] })).toEqual(['P-1', 'P-2', 'P-3', 'P-4']);
    });

    it('$or は別の列にまたがる OR を、AND の中に入れる', () => {
      expect(
        run({
          status: 'active',
          $or: [{ price: { '>=': 1000 } }, { name: 'Pen' }],
        }),
      ).toEqual(['P-1', 'P-2']);
      expect(run({ $or: [] })).toEqual([]);
    });

    it('$not は条件のまとまりを否定する', () => {
      expect(run({ $not: { status: 'active', price: { '<': 1000 } } })).toEqual(
        ['P-2', 'P-3', 'P-4'],
      );
    });

    it('知らない $ のキーは無視する', () => {
      expect(run({ $unknown: 1 } as never)).toEqual([
        'P-1',
        'P-2',
        'P-3',
        'P-4',
      ]);
    });

    it('関数をそのまま渡せる', () => {
      expect(run((item) => item.price > 1000)).toEqual(['P-2', 'P-3']);
      expect(
        run({ $and: [{ status: 'active' }, (item) => item.price > 1000] }),
      ).toEqual(['P-2']);
    });
  });

  describe('値の一覧', () => {
    it('$value で要素そのものの条件を書く', () => {
      expect(
        [5, 10, 20].filter(createFilter<number>({ $value: { '>=': 10 } })),
      ).toEqual([10, 20]);
      expect(
        ['onClick', 'onChange', 'value'].filter(
          createFilter<string>({ $value: { startsWith: 'on' } }),
        ),
      ).toEqual(['onClick', 'onChange']);
    });
  });

  describe('JSON の条件', () => {
    it('JSON から読んだ条件をそのまま渡せる', () => {
      const spec = JSON.parse(
        '{ "$or": [{ "status": "archived" }, { "price": { "<": 200 } }] }',
      ) as FilterSpec;
      expect(ids(products.filter(createFilter<Product>(spec)))).toEqual([
        'P-3',
        'P-4',
      ]);
    });
  });
});
