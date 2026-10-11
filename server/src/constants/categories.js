// Category colours are CSS variables defined in client/src/styles/styles.css
export const CATEGORIES = [
  { id: 'coffee',  name: 'Coffee',   color: 'var(--peach)' },
  { id: 'tea',     name: 'Tea',      color: 'var(--mint)' },
  { id: 'bakery',  name: 'Bakery',   color: 'var(--butter)' },
  { id: 'meals',   name: 'Meals',    color: 'var(--sky)' },
  { id: 'dessert', name: 'Desserts', color: 'var(--rose)' },
  { id: 'drinks',  name: 'Drinks',   color: 'var(--lilac)' },
];

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id);
