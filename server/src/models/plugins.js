// Shared JSON shape: expose `id`, hide `_id`, `__v` and internal fields.
export function cleanJson(hidden = []) {
  return {
    virtuals: true,
    versionKey: false,
    transform(_doc, ret) {
      ret.id = String(ret._id);
      delete ret._id;
      for (const key of hidden) delete ret[key];
      return ret;
    },
  };
}
