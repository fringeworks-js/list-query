/**
 * 素のオブジェクトか（`Object.prototype` か `null` を親に持つもの。`Date`・`RegExp` などの組み込みのオブジェクトや
 * クラスのインスタンスを除く）
 */
export default function _isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
