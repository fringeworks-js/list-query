import { get } from '@fringeworks/utils/object/get';
import {
  parsePropertyPath,
  type PropertyPath,
} from '@fringeworks/utils/object/parsePropertyPath';

/**
 * 列のパスから、要素の値を取り出す関数を作る
 *
 * パスは `@fringeworks/utils` の `parsePropertyPath` の規則で読む（`'address.city'`、`'lines[0]'`、
 * `'["a.b"]'` のように引用符で囲むと `.` を含むキーも書ける）。パスは作るときに1回だけ解釈する
 *
 * @param path 列のパス
 * @returns 要素の値を取り出す関数。途中が無ければ undefined を返す
 */
export default function _createGetter(
  path: PropertyPath,
): (item: unknown) => unknown {
  const keys = parsePropertyPath(path);
  return (item) => get(item, keys);
}
