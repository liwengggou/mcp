import { ConceptCategory, CATEGORY_LABELS, CATEGORY_COLORS } from '../types';

interface CategoryFilterProps {
  value: ConceptCategory | null;
  onChange: (value: ConceptCategory | null) => void;
  counts: Record<ConceptCategory, number>;
}

const categories: ConceptCategory[] = ['language', 'library', 'pattern', 'architecture'];

export function CategoryFilter({ value, onChange, counts }: CategoryFilterProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
          value === null
            ? 'bg-gray-800 text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
        onClick={() => onChange(null)}
      >
        All ({Object.values(counts).reduce((a, b) => a + b, 0)})
      </button>
      {categories.map((category) => (
        <button
          key={category}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            value === category
              ? CATEGORY_COLORS[category].replace('100', '600').replace('800', 'white')
              : `${CATEGORY_COLORS[category]} hover:opacity-80`
          }`}
          onClick={() => onChange(value === category ? null : category)}
        >
          {CATEGORY_LABELS[category]} ({counts[category]})
        </button>
      ))}
    </div>
  );
}
