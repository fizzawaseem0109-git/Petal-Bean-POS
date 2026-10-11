// Same rounding the original app used: 2 decimal places.
export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
